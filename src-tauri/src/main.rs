// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]


mod commands;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard::init())
        .invoke_handler(tauri::generate_handler!
            [
                commands::load_templates,
                commands::save_template,
                commands::load_favourites,
                commands::save_favourites,
                commands::load_locations,
                commands::save_signature_to_file,
                commands::load_signature_file,
                commands::delete_signature_file,
                commands::load_signatures,
                commands::get_signature_image_base64,
                commands::load_cache,
                commands::save_cache,
                commands::update_cache,
                commands::clear_cache,
                commands::load_salutations,
                commands::load_valedictions
            ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
