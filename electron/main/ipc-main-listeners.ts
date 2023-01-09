import {
  UpscaleFoldersEvent,
  UpscaleFoldersOpts,
} from "../../src/types/IpcRendererEvents";
import { BrowserWindow, dialog, ipcMain } from "electron";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import util from "node:util";
import path from "node:path";
import child_process from "node:child_process";
import probe from "probe-image-size";
import {Ref, ref} from "vue";

export const allowUpscaleExtensions = new Set(["jpg", "jpeg", "png"]);
const exec = util.promisify(child_process.exec);

function sizeOf(filePath) {
  return probe(fsSync.createReadStream(filePath));
}
async function upscaleFile(
  e: Electron.IpcMainEvent,
  filepath: string,
  opts: UpscaleFoldersOpts,
) {
  try {
    const extension = path.extname(filepath).replace(".", "");
    if (!extension || !allowUpscaleExtensions.has(extension)) {
      upscaleLog(e, `Расширение файла "${extension}" не поддерживается.`);
      return;
    }

    const { height, width } = await sizeOf(filepath);
    const scaleHeight = opts.maxResolution.height / height;
    const scaleWidth = opts.maxResolution.width / width;
    const minScale = Math.ceil(Math.min(scaleHeight, scaleWidth));
    if (minScale <= 1) {
      upscaleLog(e, `Апскейл не нужен: ${width}x${height} у файла ${filepath}`);
      return;
    }

    const newFilePath = filepath;
    const replaceCommand = {
      filepath,
      newFilePath,
    };
    let commandExec = opts.command;
    Object.keys(replaceCommand).forEach((key) => {
      commandExec = commandExec.replace("{{" + key + "}}", replaceCommand[key]);
    });
    upscaleLog(e, `Выполняется команда: ${commandExec}`);
    await exec(commandExec);
  } catch (er: any) {
    console.log({ er });
    upscaleLog(e, "Ошибка в upscaleFile!", JSON.stringify(er));
  }
}

async function upscaleDirs(
  e: Electron.IpcMainEvent,
  dirs: string[],
  opts: UpscaleFoldersOpts,
  cancellationToken: Ref<boolean>,
) {
  try {
    for (let currentDir of dirs) {
      const files = await fs.readdir(currentDir, { withFileTypes: true });
      upscaleLog(e, "Найдены файлы:", files.map((x) => x.name).join(", "));
      const newDirs: string[] = [];
      for (const filename of files) {
        const filepath = path.join(currentDir, filename.name);
        if (filename.isDirectory()) {
          newDirs.push(filepath);
          continue;
        }

        upscaleLog(e, `Файл: ${filepath}`);
        await upscaleFile(e, filepath, opts);
        if (cancellationToken.value === true) {
          return;
        }
      }

      if (newDirs.length) {
        await upscaleDirs(e, newDirs, opts, cancellationToken);
      }
    }
  } catch (er: any) {
    console.log({ er });
    upscaleLog(e, "Ошибка в upscaleDirs!", JSON.stringify(er));
  }
}

function upscaleLog(e: Electron.IpcMainEvent, ...log: string[]) {
  e.reply("upscaler-log", log.join("\n"));
}

export function register(win: BrowserWindow) {
  ipcMain.on("select-dirs", async (event, arg) => {
    const result = await dialog.showOpenDialog(win, {
      properties: ["openDirectory", "multiSelections"],
    });
    event.reply("selected-folder", result.filePaths);
  });

  ipcMain.on("upscale-folders", async (e, arg: UpscaleFoldersEvent) => {
    const cancellationToken = ref(false);
    const handlerUpscalerCancel = () => {
      cancellationToken.value = true;
    };
    try {
      ipcMain.on('upscaler-cancel', handlerUpscalerCancel);
      await upscaleDirs(e, arg.paths, arg.opts, cancellationToken);
      upscaleLog(e, "Завершено!");
    } catch (er) {
      console.log({ er });
      upscaleLog(e, "Ошибка в начале!", JSON.stringify(er));
    }
    e.reply("upscaler-finish");
    ipcMain.off('upscaler-cancel', handlerUpscalerCancel);
  });
}
