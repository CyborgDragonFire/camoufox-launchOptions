import fs from "node:fs/promises";
import path from "node:path";
import clm from "country-locale-map";
import { type CityResponse, type CountryResponse, Reader } from "maxmind";
import { z } from "zod/v4/mini";
import type { ipOutputObjectType } from "./proxy";

function pickPubIP(ipObject: ipOutputObjectType) {
    if (typeof ipObject.ipv4 === "string" && ipObject.ipv6 === false) {
        return ipObject.ipv4;
    }
    if (ipObject.ipv4 === false && typeof ipObject.ipv6 === "string") {
        return ipObject.ipv6;
    }
    if (typeof ipObject.ipv4 === "string" && typeof ipObject.ipv6 === "string") {
        return ipObject.ipv4;
    }
    throw new Error("Geolocation and Locale error, A valid IP address is requied");
}

const geolocationAndLocaleObject = z.strictObject({
    longitude: z.number(),
    latitude: z.number(),
    accuracy: z.number(),
    timezone: z.optional(z.string()),
    locales: z.string(),
});

export async function getGeolocationAndLocale(ipObject: ipOutputObjectType, directory: string) {
    const pubIP = pickPubIP(ipObject);

    const parsedDirectory = path.parse(directory);
    const mmdbFile = path.resolve(parsedDirectory.dir, "GeoLite2-City.mmdb");

    const fileStats = await fs.stat(mmdbFile);
    if (fileStats.isFile()) {
        const buffer = await fs.readFile(mmdbFile);

        const cityLookup = new Reader<CityResponse>(buffer);
        const countryLookup = new Reader<CountryResponse>(buffer);

        const maxmindCity = cityLookup.get(pubIP);
        const maxmindCountry = countryLookup.get(pubIP);

        if (maxmindCity && maxmindCountry) {
            const location = maxmindCity.location;
            const country = maxmindCountry.country;

            if (location && country) {
                const clmData = clm.getCountryByAlpha2(country.iso_code);

                if (clmData) {
                    const geoDataOutput = geolocationAndLocaleObject.parse({
                        longitude: location.longitude,
                        latitude: location.latitude,
                        accuracy: location.accuracy_radius,
                        timezone: location.time_zone,
                        locales: clmData.locales.join(", "),
                    });
                    return geoDataOutput;
                }
                throw new Error("Geolocation and Locale error, Unknown iso country code");
            }
            throw new Error(`Geolocation and Locale error, No geoData found for current IP: ${pubIP}`);
        }
        throw new Error(`Geolocation and Locale error, No geoData found for current IP: ${pubIP}`);
    }
    throw new Error("Geolocation and Locale error, '.mmdb' file not found");
}
