use jgenesis_common::frontend::{
    AudioOutput, ConstantInputPoller, EmulatorTrait, FrameSize, MappableInputs, RenderFrameOptions,
    Renderer, SaveWriter, TickEffect,
};
use jgenesis_common::input::Player;
use snes_config::SnesButton;
use snes_core::api::{CoprocessorRoms, SnesEmulator, SnesEmulatorConfig};
use snes_core::input::SnesInputs;
use std::alloc::{alloc, dealloc, Layout};
use std::cell::RefCell;
use std::error::Error;
use std::fmt::{Display, Formatter};
use std::ptr;
use std::slice;

const AUDIO_RATE: u32 = 48_000;
const MAX_TICKS_PER_FRAME: usize = 3_000_000;
const ALLOC_HEADER_BYTES: usize = 8;

const BTN_A: u32 = 0;
const BTN_B: u32 = 1;
const BTN_X: u32 = 2;
const BTN_Y: u32 = 3;
const BTN_L: u32 = 4;
const BTN_R: u32 = 5;
const BTN_SELECT: u32 = 8;
const BTN_START: u32 = 9;
const BTN_UP: u32 = 12;
const BTN_DOWN: u32 = 13;
const BTN_LEFT: u32 = 14;
const BTN_RIGHT: u32 = 15;

#[link(wasm_import_module = "wisp")]
extern "C" {
    #[link_name = "video_refresh"]
    fn host_video_refresh(rgba_ptr: u32, width: u32, height: u32, pitch_bytes: u32);
    #[link_name = "audio_batch"]
    fn host_audio_batch(s16_ptr: u32, frames: u32, sample_rate: u32, channels: u32);
    #[link_name = "input_state"]
    fn host_input_state(port: u32, control: u32) -> i32;
}

#[derive(Debug, Clone, Copy)]
struct CoreError;

impl Display for CoreError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_str("Wisp core operation failed")
    }
}

impl Error for CoreError {}

#[derive(Default)]
struct SaveStore {
    sav: Vec<u8>,
}

impl SaveWriter for SaveStore {
    type Err = CoreError;

    fn load_bytes(&mut self, extension: &str) -> Result<Vec<u8>, Self::Err> {
        if extension == "sav" && !self.sav.is_empty() {
            Ok(self.sav.clone())
        } else {
            Err(CoreError)
        }
    }

    fn persist_bytes(&mut self, extension: &str, bytes: &[u8]) -> Result<(), Self::Err> {
        if extension != "sav" {
            return Err(CoreError);
        }
        self.sav.clear();
        self.sav.extend_from_slice(bytes);
        Ok(())
    }

    fn load_serialized<D: bincode::Decode<()>>(&mut self, extension: &str) -> Result<D, Self::Err> {
        let bytes = self.load_bytes(extension)?;
        bincode::decode_from_slice(&bytes, bincode::config::standard())
            .map(|(value, _)| value)
            .map_err(|_| CoreError)
    }

    fn persist_serialized<E: bincode::Encode>(
        &mut self,
        extension: &str,
        data: E,
    ) -> Result<(), Self::Err> {
        let bytes = bincode::encode_to_vec(data, bincode::config::standard()).map_err(|_| CoreError)?;
        self.persist_bytes(extension, &bytes)
    }
}

struct HostRenderer;

impl Renderer for HostRenderer {
    type Err = CoreError;

    fn render_frame(
        &mut self,
        frame_buffer: &[jgenesis_common::frontend::Color],
        frame_size: FrameSize,
        _target_fps: f64,
        _options: RenderFrameOptions,
    ) -> Result<(), Self::Err> {
        let required = frame_size.width as usize * frame_size.height as usize;
        if frame_size.width == 0 || frame_size.height == 0 || required > frame_buffer.len() {
            return Err(CoreError);
        }
        unsafe {
            host_video_refresh(
                frame_buffer.as_ptr() as usize as u32,
                frame_size.width,
                frame_size.height,
                frame_size.width.saturating_mul(4),
            );
        }
        Ok(())
    }
}

struct HostAudio {
    samples: Vec<i16>,
}

impl HostAudio {
    fn new() -> Self {
        Self { samples: Vec::with_capacity(4096) }
    }

    fn begin_frame(&mut self) {
        self.samples.clear();
    }

    fn flush(&self) {
        if self.samples.len() < 2 {
            return;
        }
        unsafe {
            host_audio_batch(
                self.samples.as_ptr() as usize as u32,
                (self.samples.len() / 2) as u32,
                AUDIO_RATE,
                2,
            );
        }
    }
}

impl AudioOutput for HostAudio {
    type Err = CoreError;

    fn push_sample(&mut self, sample_l: f64, sample_r: f64) -> Result<(), Self::Err> {
        self.samples.push(float_to_s16(sample_l));
        self.samples.push(float_to_s16(sample_r));
        Ok(())
    }
}

fn float_to_s16(value: f64) -> i16 {
    (value.clamp(-1.0, 1.0) * f64::from(i16::MAX)).round() as i16
}

struct CoreState {
    emulator: SnesEmulator,
    inputs: SnesInputs,
    saves: SaveStore,
    audio: HostAudio,
}

// ABI 1 is single-threaded and non-reentrant. Each module instance owns exactly one session.
// Thread-local interior mutability makes that ownership explicit without `static mut` references.
thread_local! {
    static CORE: RefCell<Option<CoreState>> = RefCell::new(None);
}

fn replace_core(state: Option<CoreState>) {
    CORE.with(|slot| *slot.borrow_mut() = state);
}

fn take_core() -> Option<CoreState> {
    CORE.with(|slot| slot.borrow_mut().take())
}

fn with_core<R>(f: impl FnOnce(&CoreState) -> R) -> Option<R> {
    CORE.with(|slot| slot.borrow().as_ref().map(f))
}

fn with_core_mut<R>(f: impl FnOnce(&mut CoreState) -> R) -> Option<R> {
    CORE.with(|slot| slot.borrow_mut().as_mut().map(f))
}

fn pressed(control: u32) -> bool {
    unsafe { host_input_state(0, control) != 0 }
}

fn update_inputs(inputs: &mut SnesInputs) {
    let mappings = [
        (SnesButton::A, BTN_A),
        (SnesButton::B, BTN_B),
        (SnesButton::X, BTN_X),
        (SnesButton::Y, BTN_Y),
        (SnesButton::L, BTN_L),
        (SnesButton::R, BTN_R),
        (SnesButton::Select, BTN_SELECT),
        (SnesButton::Start, BTN_START),
        (SnesButton::Up, BTN_UP),
        (SnesButton::Down, BTN_DOWN),
        (SnesButton::Left, BTN_LEFT),
        (SnesButton::Right, BTN_RIGHT),
    ];
    for (button, control) in mappings {
        inputs.set_field(button, Player::One, pressed(control));
    }
}

#[no_mangle]
pub extern "C" fn wisp_core_api_version() -> u32 {
    1
}

#[no_mangle]
pub extern "C" fn wisp_core_init() -> i32 {
    replace_core(None);
    1
}

#[no_mangle]
pub unsafe extern "C" fn wisp_core_load_game(ptr: u32, bytes: u32) -> i32 {
    if ptr == 0 || bytes == 0 {
        return 0;
    }
    replace_core(None);
    let rom = slice::from_raw_parts(ptr as usize as *const u8, bytes as usize).to_vec();
    let mut saves = SaveStore::default();
    let mut emulator = match SnesEmulator::create(
        rom,
        SnesEmulatorConfig::default(),
        CoprocessorRoms::none(),
        &mut saves,
    ) {
        Ok(emulator) => emulator,
        Err(_) => return 0,
    };
    emulator.update_audio_output_frequency(u64::from(AUDIO_RATE));
    replace_core(Some(CoreState {
        emulator,
        inputs: SnesInputs::default(),
        saves,
        audio: HostAudio::new(),
    }));
    1
}

#[no_mangle]
pub extern "C" fn wisp_core_run() {
    let Some(mut state) = take_core() else { return };

    update_inputs(&mut state.inputs);
    state.audio.begin_frame();
    let mut renderer = HostRenderer;
    let mut poller = ConstantInputPoller(&state.inputs);
    for _ in 0..MAX_TICKS_PER_FRAME {
        match state.emulator.tick(
            &mut renderer,
            &mut state.audio,
            &mut poller,
            &mut state.saves,
        ) {
            Ok(TickEffect::FrameRendered) => {
                state.audio.flush();
                break;
            }
            Ok(TickEffect::None) => {}
            Err(_) => break,
        }
    }

    replace_core(Some(state));
}

#[no_mangle]
pub extern "C" fn wisp_core_reset() {
    with_core_mut(|state| state.emulator.soft_reset());
}

#[no_mangle]
pub extern "C" fn wisp_core_unload() {
    replace_core(None);
}

#[no_mangle]
pub extern "C" fn wisp_core_deinit() {
    replace_core(None);
}

#[no_mangle]
pub unsafe extern "C" fn wisp_core_alloc(bytes: u32) -> u32 {
    if bytes == 0 {
        return 0;
    }
    let Some(total) = (bytes as usize).checked_add(ALLOC_HEADER_BYTES) else { return 0 };
    let Ok(layout) = Layout::from_size_align(total, ALLOC_HEADER_BYTES) else { return 0 };
    let raw = alloc(layout);
    if raw.is_null() {
        return 0;
    }
    ptr::write(raw.cast::<u32>(), bytes);
    raw.add(ALLOC_HEADER_BYTES) as usize as u32
}

#[no_mangle]
pub unsafe extern "C" fn wisp_core_free(ptr_value: u32) {
    if ptr_value == 0 {
        return;
    }
    let raw = (ptr_value as usize as *mut u8).sub(ALLOC_HEADER_BYTES);
    let bytes = ptr::read(raw.cast::<u32>()) as usize;
    let Some(total) = bytes.checked_add(ALLOC_HEADER_BYTES) else { return };
    if let Ok(layout) = Layout::from_size_align(total, ALLOC_HEADER_BYTES) {
        dealloc(raw, layout);
    }
}

#[no_mangle]
pub extern "C" fn wisp_core_save_ram_size() -> u32 {
    with_core(|state| state.saves.sav.len().min(u32::MAX as usize) as u32).unwrap_or(0)
}

#[no_mangle]
pub unsafe extern "C" fn wisp_core_export_save_ram(ptr_value: u32, capacity: u32) -> u32 {
    with_core(|state| {
        let bytes = state.saves.sav.len();
        if ptr_value == 0 || bytes == 0 || bytes > capacity as usize || bytes > u32::MAX as usize {
            return 0;
        }
        ptr::copy_nonoverlapping(state.saves.sav.as_ptr(), ptr_value as usize as *mut u8, bytes);
        bytes as u32
    })
    .unwrap_or(0)
}

#[no_mangle]
pub unsafe extern "C" fn wisp_core_import_save_ram(ptr_value: u32, bytes: u32) -> i32 {
    if ptr_value == 0 || bytes == 0 {
        return 0;
    }
    let input = slice::from_raw_parts(ptr_value as usize as *const u8, bytes as usize).to_vec();
    with_core_mut(|state| {
        state.saves.sav.clear();
        state.saves.sav.extend_from_slice(&input);
        state.emulator.hard_reset(&mut state.saves);
        1
    })
    .unwrap_or(0)
}
