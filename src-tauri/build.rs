fn main() {
    // Manifiesto de Windows para los binarios de TEST: los tests de
    // integración (tests/*.rs) no pasan por tauri_build::build(), así que no
    // reciben el manifiesto default con la dependencia de Common-Controls v6
    // que tao/wry necesitan → STATUS_ENTRYPOINT_NOT_FOUND al enlazar
    // comctl32. Escribe un .manifest junto al crate y lo incrusta con
    // /MANIFESTINPUT (mismo mecanismo que embed_manifest_for_tests de tauri).
    #[cfg(windows)]
    {
        let manifest = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests/windows-test-manifest.xml");
        println!("cargo:rerun-if-changed={}", manifest.display());
        println!("cargo:rustc-link-arg-tests=/MANIFEST:EMBED");
        println!(
            "cargo:rustc-link-arg-tests=/MANIFESTINPUT:{}",
            manifest.display()
        );
    }
    tauri_build::build()
}
