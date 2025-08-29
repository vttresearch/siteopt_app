// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs::{create_dir_all, File};
use std::path::PathBuf;
use std::process::{Command, Stdio, Child};
use std::sync::{Arc, Mutex};
use tauri::{generate_context, is_dev, RunEvent, Manager};
#[cfg(target_os = "windows")]  // This is for the tauri app window
use std::os::windows::process::CommandExt;


fn main() {
    // Shared state to hold the backend process
    let backend_process = Arc::new(Mutex::new(None::<Child>));
    let backend_process_clone = backend_process.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .setup(move |_app| {
            // Only start backend in production (not dev mode)
            if !is_dev() {
                println!("Starting Django backend [backend/run_django.exe]");
                // Open log file
                let log_path: PathBuf = _app
                .path()
                .app_local_data_dir()
                .expect("Failed to get app data directory")
                .join("backend.log");

            if let Some(parent) = log_path.parent() {
                    create_dir_all(parent).expect("Failed to create app data directory")
            }
                let log_file = File::create(&log_path).expect("Failed to create log file");
                let mut command = Command::new("backend/run_django.exe");
                command
                    .stdout(Stdio::from(log_file.try_clone().unwrap()))  // suppress output
                    .stderr(Stdio::from(log_file));
                #[cfg(target_os = "windows")]  // This is for the run_django.exe process cmd prompt window
                {
                    command.creation_flags(0x08000000); // CREATE_NO_WINDOW
                }
                let child = command.spawn().expect("Failed to start Django backend");
                // Store the process handle
                *backend_process.lock().unwrap() = Some(child);
            }
            Ok(())
        })
        .build(generate_context!())
        .expect("error while building tauri application")
        .run(move |_app_handle, event| {
            if let RunEvent::ExitRequested { .. } = event {
                if let Some(mut child) = backend_process_clone.lock().unwrap().take() {
                    let _ = child.kill();
                    let _ = child.wait();
                    println!("Django backend terminated.");
                }
            }
        })
}
