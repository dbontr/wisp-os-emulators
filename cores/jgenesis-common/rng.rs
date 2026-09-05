use getrandom::Error;

// jgenesis uses rand only to model undefined power-on state in the console cores we build here.
// Wisp cores deliberately use a reproducible local generator instead of browser/OS entropy.
// This function must never be reused for cryptographic material, identifiers, or security tokens.
static mut RNG_STATE: u64 = 0x4d595df4d0f33173;

#[no_mangle]
unsafe extern "Rust" fn __getrandom_v03_custom(dest: *mut u8, len: usize) -> Result<(), Error> {
    if len == 0 {
        return Ok(());
    }
    if dest.is_null() {
        return Err(Error::UNEXPECTED);
    }

    let output = core::slice::from_raw_parts_mut(dest, len);
    let mut state = RNG_STATE;
    for byte in output {
        state ^= state << 13;
        state ^= state >> 7;
        state ^= state << 17;
        *byte = state as u8;
    }
    RNG_STATE = state;
    Ok(())
}
