const path = require("path");
const os = require("os");
const { app, BrowserWindow, Menu, ipcMain, shell } = require("electron");
const imagemin = require("imagemin");
const compressJpeg = require("imagemin-mozjpeg");
const compressPng = require("imagemin-pngquant");
const slash = require("slash");
const logger = require("electron-log");

//set logger preferences
logger.transports.file.format = "{y}{m}{d} {h}{i}{s}.{ms}\t{level}\t{text}";

// Set environment
process.env.NODE_ENV = "dev";
const isDev = process.env.NODE_ENV !== "production" ? true : false;
const isMac = process.platform === "darwin" ? true : false;

// Instantiate the windows we are going to use
let mainWindow, aboutWindow;

// Set the options for each window
function createMainWindow() {
  mainWindow = new BrowserWindow({
    title: "ImageShrink",
    width: isDev ? 1000 : 500,
    height: 600,
    icon: `${__dirname}/assets/icons/Icon_256x256.png`,
    resizable: isDev, // app is resizable when in development mode
    backgroundColor: "white",
    webPreferences: { nodeIntegration: true, enableRemoteModule: true },
  });

  if (isDev) mainWindow.webContents.openDevTools();

  mainWindow.loadFile("./app/index.html");
}

function createAboutWindow() {
  aboutWindow = new BrowserWindow({
    title: "About ImageShrink",
    width: 300,
    height: 300,
    icon: `${__dirname}/assets/icons/Icon_256x256.png`,
    resizable: false,
    backgroundColor: "white",
  });

  aboutWindow.loadFile("./app/about.html");
}

// Load the main window when the app is loaded
app.on("ready", () => {
  createMainWindow();
  const mainMenu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(mainMenu);

  mainWindow.on("closed", () => (mainWindow = null));
});

// Create our custom menus
const menuTemplate = [
  ...(isMac
    ? [
        {
          label: app.name,
          submenu: [
            {
              label: "About",
              click: createAboutWindow,
            },
          ],
        },
      ]
    : []), // on macOS this will keep the electron menu, as well as our menu
  {
    role: "fileMenu",
  },
  ...(!isMac
    ? [
        {
          label: "Help",
          submenu: [
            {
              label: "About",
              click: createAboutWindow,
            },
          ],
        },
      ]
    : []),
  ...(isDev
    ? [
        {
          label: "Developer",
          submenu: [
            { role: "reload" },
            { role: "forcereload" },
            { role: "separator" },
            { role: "toggledevtools" },
          ],
        },
      ]
    : []),
];

const allowedFileTypes = ["jpg", "png"];

// Catch the form call from mainWindow
ipcMain.on("image:minimize", (e, data) => {
  const dest = path.join(os.homedir(), "imageShrink");
  //shrinkImage(data);
  let goodPaths = [];
  for (let el of data) {
    let count = 0;
    for (const [key, value] of Object.entries(allowedFileTypes)) {
      if (el.substring(el.lastIndexOf(".") + 1) === value) {
        count++;
      }
    }
    if (count == 0) {
      mainWindow.webContents.send("image:error", el);
    } else goodPaths.push(el);
  }
  goodPaths.forEach((imgPath) => {
    shrinkImage(imgPath, 30, dest);
  });
});

async function shrinkImage(imgPath, quality, dest) {
  try {
    const pngQuality = quality / 100;
    const files = await imagemin([slash(imgPath)], {
      destination: dest,
      plugins: [
        compressJpeg({ quality }),
        compressPng({ quality: [pngQuality, pngQuality] }),
      ],
    });

    files.forEach((file) => {
      mainWindow.webContents.send("image:done", slash(file.destinationPath));
      logger.info(`image source path: ${slash(file.sourcePath)}`);
      logger.info(`image saved to: ${slash(file.destinationPath)}`);
    });

    // open the destination folder
    //shell.openPath(dest);
  } catch (err) {
    logger.error(err);
  }
}

// Make the app close correctly on macOS
app.on("window-all-closed", () => {
  if (!isMac) app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
