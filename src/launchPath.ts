import fs from "node:fs/promises";
import os from "node:os";
import path, { type ParsedPath } from "node:path";
import process from "node:process";
import { z } from "zod/v4/mini";

const nodePlatform = z
    .enum(["win32", "darwin", "linux"], { error: "Unsupported Operating System" })
    .safeParse(process.platform);

if (!nodePlatform.success) {
    throw new Error(z.prettifyError(nodePlatform.error));
}
const osName = nodePlatform.data;

function getDefaultInstallDirectory() {
    if (osName === "win32") {
        return path.join(os.homedir(), "AppData", "Local", "camoufox", "camoufox", "Cache");
    }
    if (osName === "darwin") {
        const basePath = path.join(os.homedir(), "Library", "Caches", "camoufox");
        return path.resolve(basePath, "Camoufox.app", "Contents", "Resources", "../MacOS");
    }
    if (osName === "linux") {
        return path.join(os.homedir(), ".cache", "camoufox");
    }
    throw new Error("Unsupported Operating System");
}
const defaultInstall = getDefaultInstallDirectory();

const camoufoxExecutable = {
    win32: "camoufox.exe",
    darwin: "camoufox",
    linux: "camoufox-bin",
} as const;

async function validatedExecutablePath(directory: ParsedPath, executable: string) {
    const parsedExecutable = path.resolve(directory.dir, executable);

    const fileStats = await fs.stat(parsedExecutable);
    if (fileStats.isFile()) {
        return parsedExecutable;
    }
    return false;
}

async function checkIfCamoufoxIsInstalled(directory: string) {
    const parsedDirectory = path.parse(directory);

    const directoryStats = await fs.stat(parsedDirectory.dir);
    if (directoryStats.isDirectory()) {
        const executableValid = await validatedExecutablePath(parsedDirectory, camoufoxExecutable[osName]);

        if (executableValid) {
            return executableValid;
        }
        return false;
    }
    return false;
}

export async function launchPath(customInstall?: string) {
    const camoufoxInstalled = customInstall
        ? await checkIfCamoufoxIsInstalled(customInstall)
        : await checkIfCamoufoxIsInstalled(defaultInstall);

    if (camoufoxInstalled) {
        return camoufoxInstalled;
    }
    throw new Error("Camoufox is Not Installed");
}
