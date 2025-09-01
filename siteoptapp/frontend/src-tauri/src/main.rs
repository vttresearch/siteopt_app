#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs::{create_dir_all, File};
use std::path::PathBuf;
use std::process::{Command, Stdio, Child};
use std::sync::{Arc, Mutex};
use tauri::{generate_context, is_dev, RunEvent, Manager};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
use std::os::windows::io::AsRawHandle;

#[cfg(target_os = "windows")]
use windows::Win32::System::JobObjects::{
    CreateJobObjectW, AssignProcessToJobObject, SetInformationJobObject,
    JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    JobObjectExtendedLimitInformation,
};

#[cfg(target_os = "windows")]
use windows::Win32::System::Threading::CREATE_NO_WINDOW;

#[cfg(target_os = "windows")]
use windows::Win32::Foundation::{HANDLE, CloseHandle};
#[cfg(target_os = "windows")]
use windows::core::PCWSTR;

fn main() {
    let backend_process = Arc::new(Mutex::new(None::<Child>));
    let backend_process_clone = backend_process.clone();

    #[cfg(target_os = "windows")]
    let job_handle = Arc::new(Mutex::new(None::<HANDLE>));
    #[cfg(target_os = "windows")]
    let job_handle_clone = job_handle.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .setup(move |_app| {
            if !is_dev() {
                println!("Starting Django backend [backend/run_django.exe]");
                let log_path: PathBuf = _app
                    .path()
                    .app_local_data_dir()
                    .expect("Failed to get app data directory")
                    .join("backend.log");
                if let Some(parent) = log_path.parent() {
                    create_dir_all(parent).expect("Failed to create app data directory");
                }
                let log_file = File::create(&log_path).expect("Failed to create log file");
                let mut command = Command::new("backend/run_django.exe");
                command
                    .stdout(Stdio::from(log_file.try_clone().unwrap()))
                    .stderr(Stdio::from(log_file));
                #[cfg(target_os = "windows")]
                {
                    command.creation_flags(CREATE_NO_WINDOW.0);
                }
                let child = command.spawn().expect("Failed to start Django backend");
                #[cfg(target_os = "windows")]
                {
                    unsafe {
                        let job = CreateJobObjectW(None, PCWSTR::null()).expect("Failed to create Job Object");
                        let mut info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
                        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                        let result = SetInformationJobObject(
                            job,
                            JobObjectExtendedLimitInformation,
                            &info as *const _ as *const _,
                            std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                        );
                        if !result.as_bool() {
                            panic!("Failed to set job object information");
                        }
                        let handle = HANDLE(child.as_raw_handle() as isize);
                        let result = AssignProcessToJobObject(job, handle);
                        if !result.as_bool() {
                            panic!("Failed to assign process to job object");
                        }
                        *job_handle.lock().unwrap() = Some(job);
                    }
                }
                *backend_process.lock().unwrap() = Some(child);
            }
            Ok(())
        })
        .build(generate_context!())
        .expect("error while building tauri application")
        .run(move |_app_handle, event| {
            if let RunEvent::Exit = event {
                if let Some(mut child) = backend_process_clone.lock().unwrap().take() {
                    let _ = child.kill(); // Optional, job object will handle it
                    let _ = child.wait();
                    println!("Django backend terminated.");
                }
                #[cfg(target_os = "windows")]
                {
                    if let Some(job) = job_handle_clone.lock().unwrap().take() {
                        unsafe {
                            let _ = CloseHandle(job); // This kills all processes in the job
                        }
                        println!("Job object closed, all subprocesses terminated.");
                    }
                }
            }
        });
}
