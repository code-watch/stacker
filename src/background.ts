'use strict';

import {app, protocol, BrowserWindow, ipcMain} from 'electron'
import {
    createProtocol,
    /* installVueDevtools */
} from 'vue-cli-plugin-electron-builder/lib'
import {OutputRequisitionModel} from "enqueuer";
import {InputRequisitionModel} from "enqueuer";
import * as fs from 'fs';
import * as shell from "child_process";

const isDevelopment = process.env.NODE_ENV !== 'production';

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win: BrowserWindow | null;

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([{scheme: 'app', privileges: {secure: true, standard: true}}]);


let nqr: any = undefined;
try {
    // const ls = shell.spawn("node_modules/.bin/enqueuer", {
    nqr = shell.spawn("enqueuer", {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });

// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
    nqr.stdout.on("data", data => {
        console.log(`stdout: ${data}`);
    });

// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
    nqr.stderr.on("data", data => {
        console.log(`stderr: ${data}`);
    });

    nqr.on('disconnect', (error: any) => {
        console.log(`disconnect: ${error}`);
    });

    nqr.on('error', (error: any) => {
        console.log(`error: ${error.message}`);
    });

    nqr.on("close", (code: number) => {
        console.log(`child process exited with code ${code}`);
    });

} catch (e) {
    console.log(e)
}

async function runNqr(requisitionInput: InputRequisitionModel) {
    return new Promise(resolve => {
        nqr.send({event: 'runRequisition', value: requisitionInput});
        nqr.on('message', (message: any) => {
            if (message.event === 'REQUISITION_FINISHED' && message.value.requisition) {
                const requisitionOutput: OutputRequisitionModel = message.value.requisition;
                if (requisitionOutput.id.toString() === requisitionInput.id.toString()) {
                    console.log('this is it');
                    resolve(requisitionOutput);
                }
            }
        });
    });
}

function createWindow() {
    // Create the browser window.
    win = new BrowserWindow({
        width: 1440,
        height: 1000,
        webPreferences: {
            nodeIntegration: true
        }
    });

    if (process.env.WEBPACK_DEV_SERVER_URL) {
        // Load the url of the dev server if in development mode
        win.loadURL(process.env.WEBPACK_DEV_SERVER_URL as string);
        if (!process.env.IS_TEST) win.webContents.openDevTools()
    } else {
        createProtocol('app');
        // Load the index.html when not in development
        win.loadURL('app://./index.html')
    }

    win.on('closed', () => {
        win = null
    });

}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
});


async function declareGlobals() {
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    global.runEnqueuer = async (requisition: any) => await runNqr(requisition);
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    global.external = (await import('/Users/guilherme.moraes/Dev/carabina/external.js') as any) as any;
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    global.fs = fs;
}

declareGlobals();

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
        createWindow();
    }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
        if (isDevelopment && !process.env.IS_TEST) {
            // Install Vue Devtools
            // Devtools extensions are broken in Electron 6.0.0 and greater
            // See https://github.com/nklayman/vue-cli-plugin-electron-builder/issues/378 for more info
            // Electron will not launch with Devtools extensions installed on Windows 10 with dark mode
            // If you are not using Windows 10 dark mode, you may uncomment these lines
            // In addition, if the linked issue is closed, you can upgrade electron and uncomment these lines
            // try {
            //   await installVueDevtools()
            // } catch (e) {
            //   console.error('Vue Devtools failed to install:', e.toString())
            // }

        }
        createWindow();

        // Exit cleanly on request from parent process in development mode.
        if (isDevelopment) {
            if (process.platform === 'win32') {
                process.on('message', data => {
                    if (data === 'graceful-exit') {
                        app.quit()
                    }
                })
            } else {
                process.on('SIGTERM', () => {
                    app.quit()
                })
            }
        }
    }
)
