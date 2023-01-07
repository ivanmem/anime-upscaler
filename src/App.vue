<script lang="ts" setup>
import {reactive, ref} from "vue";
import {ipcRenderer} from "electron";
import {UpscaleFoldersEvent} from "./types/IpcRendererEvents";

const values = reactive<{
  paths: string[];
  logs: string;
  command: string;
  maxResolution: {
    width: number;
    height: number;
  };
  runningNow: boolean;
}>({
  paths: [],
  logs: 'Скачайте github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip \nИ распакуйте сюда F:\\realesrgan-ncnn-vulkan-20220424-windows\\ или в другое место, но тогда придётся поменять путь в команде.',
  maxResolution: {
    width: 2560,
    height: 2160,
  },
  command: `F:\\realesrgan-ncnn-vulkan-20220424-windows\\realesrgan-ncnn-vulkan.exe -i "{{filepath}}" -o "{{newFilePath}}" -f auto -n realesrgan-x4plus-anime`,
  runningNow: false,
});
console.log(
    "[App.vue]",
    `Hello world from Electron ${process.versions.electron}!`,
);

function onSelectFolder(e: Event) {
  ipcRenderer.send("select-dirs");
}

function onCancel(e: Event) {
  ipcRenderer.send("upscaler-cancel");
}

ipcRenderer.on("selected-folder", (event, paths: string[]) => {
  values.paths = paths;
});

ipcRenderer.on("upscaler-log", (event, log: string) => {
  values.logs = log + "\n" + values.logs;
});

ipcRenderer.on("upscaler-finish", (event) => {
  values.runningNow = false;
});

function onUpscaleVk() {
  values.runningNow = true;
  const event: UpscaleFoldersEvent = {
    paths: [...values.paths],
    opts: {
      maxResolution: {
        width: values.maxResolution.width,
        height: values.maxResolution.height,
      },
      command: values.command,
    },
  };
  ipcRenderer.send("upscale-folders", event);
}
</script>

<template>
  <div class="flex-grow-overflow" style="overflow: auto; flex-direction: column; padding: 10px; flex-grow: 1;">
    <div style="display: flex; flex-direction: column; gap: 5px;">
      <div style="display: flex; gap: 5px; justify-content: left;">
        <button v-if="!values.runningNow" @click="onSelectFolder">Выбрать папки</button>
        <button v-if="values.paths.length && !values.runningNow" @click="onUpscaleVk">
          Увеличить в 4 раза
        </button>
        <button v-if="values.runningNow" @click="onCancel">
          Отменить
        </button>
      </div>
      <span style="text-align: left;">
        Выбранные папки:
        {{ values.paths.length ? values.paths.join(", ") : "не выбрано" }}
      </span>
      <label style="text-align: left;">
        <span> Команда </span>
        <input v-model="values.command" style="width: 100%;"/>
      </label>
      <span> Не обрабатывать, если изображение больше, либо равно </span>
      <label>

        <input v-model="values.maxResolution.width" type="number"/>
        <span> x </span>
        <input v-model="values.maxResolution.height" type="number"/>
      </label>

      <span style="text-align: left;"> Логи: </span>
    </div>
    <pre class="flex-grow-overflow code" style="flex-grow: 1;">{{ values.logs }}</pre>
  </div>
</template>

<style>
.flex-grow-overflow {
  display: flex;
  overflow: auto;
  width: 100%;
  height: 100%;
}
</style>
