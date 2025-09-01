import process from "node:process";
import type { LaunchOptions as PlaywrightLaunchOptions } from "playwright-core";
import { z } from "zod/v4/mini";
import { getGeolocationAndLocale } from "./geoData";
import { addToConfig } from "./helper";
import { launchPath } from "./launchPath";
import { getPublicIP } from "./proxy";

const zodCamoufoxLaunchOptions = z.discriminatedUnion("proxy", [
    z.strictObject({
        /**
         * Whether to run the browser in headless mode.
         * Defaults to `true`
         */
        headless: z.optional(z.boolean()),
        /**
         * Proxy to use for the browser.
         * NOTE: If using a proxy `geoip` must be enabled as well.
         */
        proxy: z.optional(z.undefined()),
        /**
         * Calculate longitude, latitude, time zone, country, & locale based on the IP address.
         * Either `true` to find the IP address automatically or an object containing valid ip addresses.
         */
        geoip: z.optional(
            z.union([
                z.boolean(),
                z.discriminatedUnion("ipv4", [
                    z.strictObject({
                        /**
                         * ONE valid ipv4 address.
                         * For example: `62.151.215.170` or `221.43.107.78`
                         */
                        ipv4: z.ipv4(),
                        /**
                         * ONE valid ipv6 address.
                         * For example: `1be7:c800:3ecf:f4c9:d2d2:b258:5d0f:f5f2` or shorthand `d8ac:ae51:84ea::1fe8`
                         */
                        ipv6: z.optional(z.ipv6()),
                    }),
                    z.strictObject({
                        /**
                         * ONE valid ipv4 address.
                         * For example: `62.151.215.170` or `221.43.107.78`
                         */
                        ipv4: z.optional(z.ipv4()),
                        /**
                         * ONE valid ipv6 address.
                         * For example: `1be7:c800:3ecf:f4c9:d2d2:b258:5d0f:f5f2` or shorthand `d8ac:ae51:84ea::1fe8`
                         */
                        ipv6: z.ipv6(),
                    }),
                ]),
            ]),
        ),
        /**
         * Humanize the cursor movement.
         * Takes either `true`, or the MAX duration in seconds of the cursor movement.
         * The cursor typically takes up to 1.5 seconds to move across the window.
         */
        humanize: z.optional(z.union([z.boolean(), z.number().check(z.positive())])),
        /**
         * Cache previous pages, requests, etc.
         * WARNING: This will use more memory!
         * Take care if using this option in server environments.
         */
        enableCache: z.optional(z.boolean()),
        /**
         * A valid filepath to a directory containing a custom Camoufox installation.
         */
        executablePath: z.optional(z.string()),
    }),
    z.strictObject({
        /**
         * Whether to run the browser in headless mode.
         * Defaults to `true`
         */
        headless: z.optional(z.boolean()),
        /**
         * Proxy to use for the browser.
         * NOTE: If using a proxy `geoip` must be enabled as well.
         */
        proxy: z.strictObject({
            /**
             * Proxy to be used for all requests. HTTP and SOCKS proxies are supported.
             * For example: `https://myproxy.domain.com:3128` or `socks5://socks.example.com`
             */
            server: z.url({
                protocol: /(^https?$|^socks5$)/,
                normalize: true,
                error: "Unsupported Proxy Protocol, Only 'http:', 'https:' and 'socks5:' protocols are supported",
            }),
            /**
             * Username to use if proxy requires authentication.
             */
            username: z.optional(z.string()),
            /**
             * Password to use if proxy requires authentication.
             */
            password: z.optional(z.string()),
            /**
             * Comma-separated domains to bypass proxy.
             * For example: `"chromium.org, domain.com, example.net"`
             */
            bypass: z.optional(
                z.string().check(
                    z.refine(
                        (bypassList) => {
                            const splitted = bypassList.split(",");
                            // Loop through all domains from the comma-separated user input.
                            // If all domains provided passes a regex check return true.
                            // However, if a single domain check fails, early return false.
                            for (const domain of splitted) {
                                const result = z.string().check(z.regex(z.regexes.domain)).safeParse(domain);
                                if (!result.success) {
                                    return false;
                                }
                            }
                            return true;
                        },
                        { error: "Invalid Domain in 'bypass' list" },
                    ),
                ),
            ),
        }),
        /**
         * Calculate longitude, latitude, time zone, country, & locale based on the IP address.
         * Either `true` to find the IP address automatically or an object containing valid ip addresses.
         */
        geoip: z.union([
            z.boolean(),
            z.discriminatedUnion("ipv4", [
                z.strictObject({
                    /**
                     * ONE valid ipv4 address.
                     * For example: `62.151.215.170` or `221.43.107.78`
                     */
                    ipv4: z.ipv4(),
                    /**
                     * ONE valid ipv6 address.
                     * For example: `1be7:c800:3ecf:f4c9:d2d2:b258:5d0f:f5f2` or shorthand `d8ac:ae51:84ea::1fe8`
                     */
                    ipv6: z.optional(z.ipv6()),
                }),
                z.strictObject({
                    /**
                     * ONE valid ipv4 address.
                     * For example: `62.151.215.170` or `221.43.107.78`
                     */
                    ipv4: z.optional(z.ipv4()),
                    /**
                     * ONE valid ipv6 address.
                     * For example: `1be7:c800:3ecf:f4c9:d2d2:b258:5d0f:f5f2` or shorthand `d8ac:ae51:84ea::1fe8`
                     */
                    ipv6: z.ipv6(),
                }),
            ]),
        ]),
        /**
         * Humanize the cursor movement.
         * Takes either `true`, or the MAX duration in seconds of the cursor movement.
         * The cursor typically takes up to 1.5 seconds to move across the window.
         */
        humanize: z.optional(z.union([z.boolean(), z.number().check(z.positive())])),
        /**
         * Cache previous pages, requests, etc.
         * WARNING: This will use more memory!
         * Take care if using this option in server environments.
         */
        enableCache: z.optional(z.boolean()),
        /**
         * A valid filepath to a directory containing a custom Camoufox installation.
         */
        executablePath: z.optional(z.string()),
    }),
]);
export type CamoufoxLaunchOptions = z.infer<typeof zodCamoufoxLaunchOptions>;

export async function camoufoxLaunchOptions({
    headless,
    proxy,
    geoip,
    humanize,
    enableCache,
    executablePath,
}: CamoufoxLaunchOptions) {
    // Parse the raw user input with Zod.
    const userInput = zodCamoufoxLaunchOptions.safeParse({
        headless,
        proxy,
        geoip,
        humanize,
        enableCache,
        executablePath,
    });
    if (!userInput.success) {
        throw new Error(z.prettifyError(userInput.error));
    }

    // Validated good user input, having passed Zod's parsing.
    // "zvui" - an acronym for "Zod Validated User Input"
    const zvui = userInput.data;

    // Get Camoufox's executable path, use the user input, otherwise use the Default install location.
    const vaildatedExecutablePath = await launchPath(zvui.executablePath);

    // Create the two main config variables, and their validator.
    const configCheck = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));
    const mainConfig = {} as Record<string, string | number | boolean>;
    const firefoxPrefs = {} as Record<string, string | number | boolean>;

    // **
    //  The begin of manual validating and formatting of user input.
    // **

    // If user input is NOT undefined, use the user input, otherwise Default to true.
    const headlessMode = zvui.headless !== undefined ? zvui.headless : true;

    // Zod already took care of all validation needs for proxy.
    const proxySettings = zvui.proxy;

    // Set geolocation if required.
    if (zvui.geoip) {
        const publicIP = await getPublicIP(zvui.geoip, proxySettings);

        if (publicIP.ipv4) {
            addToConfig(mainConfig, "webrtc:ipv4", publicIP.ipv4);
        }
        if (publicIP.ipv6) {
            addToConfig(mainConfig, "webrtc:ipv6", publicIP.ipv6);
        }

        const geoData = await getGeolocationAndLocale(publicIP, vaildatedExecutablePath);

        addToConfig(mainConfig, "geolocation:longitude", geoData.longitude);
        addToConfig(mainConfig, "geolocation:latitude", geoData.latitude);
        addToConfig(mainConfig, "geolocation:accuracy", geoData.accuracy);
        addToConfig(mainConfig, "locale:all", geoData.locales);
        if (geoData.timezone) {
            addToConfig(mainConfig, "timezone", geoData.timezone);
        }
    }

    //  If enabled set the humanize option.
    if (zvui.humanize) {
        addToConfig(mainConfig, "humanize", true);
        if (typeof zvui.humanize === "number") {
            addToConfig(mainConfig, "humanize:maxTime", zvui.humanize);
        }
    }

    // If enabled set firefoxPrefs config to cache previous pages, requests, etc.
    if (zvui.enableCache) {
        addToConfig(firefoxPrefs, "browser.sessionhistory.max_entries", 10);
        addToConfig(firefoxPrefs, "browser.sessionhistory.max_total_viewers", -1);
        addToConfig(firefoxPrefs, "browser.cache.memory.enable", true);
        addToConfig(firefoxPrefs, "browser.cache.disk_cache_ssl", true);
        addToConfig(firefoxPrefs, "browser.cache.disk.smart_size.enabled", true);
    }

    // Final config check, throw a pretty error if not.
    const finalMainConfig = configCheck.safeParse(mainConfig);
    const finalFirefoxPrefs = configCheck.safeParse(firefoxPrefs);
    const finalNodeEnv = configCheck.safeParse(process.env);

    if (!finalMainConfig.success) {
        throw new Error(z.prettifyError(finalMainConfig.error));
    }
    if (!finalFirefoxPrefs.success) {
        throw new Error(z.prettifyError(finalFirefoxPrefs.error));
    }
    if (!finalNodeEnv.success) {
        throw new Error(z.prettifyError(finalNodeEnv.error));
    }

    //Convert mainConfig to environment variables to be passed to Camoufox.
    const envVars = {
        ...finalMainConfig.data,
        ...finalNodeEnv.data,
    };

    // Assemble the final return object.
    const finalReturnLaunchOptions: PlaywrightLaunchOptions = {
        executablePath: vaildatedExecutablePath,
        env: envVars,
        proxy: proxySettings,
        firefoxUserPrefs: finalFirefoxPrefs.data,
        headless: headlessMode,
    };

    return finalReturnLaunchOptions;
}
