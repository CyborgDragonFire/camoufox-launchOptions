import { socksDispatcher } from "fetch-socks";
import ky from "ky";
import { ProxyAgent } from "undici";
import { z } from "zod/v4/mini";
import type { CamoufoxLaunchOptions } from "./main";

function getKyInstance(proxy: CamoufoxLaunchOptions["proxy"]) {
    if (proxy) {
        const httpRegex = /(^https?:$)/;
        const socksRegex = /(^socks5:$)/;

        const proxyUrl = new URL(proxy.server);

        if (httpRegex.test(proxyUrl.protocol)) {
            const httpDispatcher = new ProxyAgent({ uri: proxy.server });

            const kyProxy = ky.extend({ dispatcher: httpDispatcher, retry: 0 });
            return kyProxy;
        }

        if (socksRegex.test(proxyUrl.protocol)) {
            const socks5Dispatcher = socksDispatcher({
                type: 5,
                host: proxy.server,
                port: z.coerce.number().parse(proxyUrl.port),
                userId: proxy.username,
                password: proxy.password,
            });

            const kyProxy = ky.extend({ dispatcher: socks5Dispatcher, retry: 0 });
            return kyProxy;
        }
        throw new Error("Unsupported Proxy Protocol, Only 'http:', 'https:' and 'socks5:' protocols are supported");
    }
    return ky;
}

const ipInputObject = z.strictObject({
    ipv4: z.optional(z.ipv4()),
    ipv6: z.optional(z.ipv6()),
});
const ipOutputObject = z.strictObject({
    ipv4: z.union([z.ipv4(), z.literal(false)]),
    ipv6: z.union([z.ipv6(), z.literal(false)]),
});
type ipInputObjectType = z.infer<typeof ipInputObject>;
export type ipOutputObjectType = z.infer<typeof ipOutputObject>;

export async function getPublicIP(input: true | ipInputObjectType, proxy: CamoufoxLaunchOptions["proxy"]) {
    const ifObject = ipInputObject.safeParse(input);
    if (ifObject.success) {
        const ipOutput = ipOutputObject.parse({
            ipv4: ifObject.data.ipv4 ? ifObject.data.ipv4 : false,
            ipv6: ifObject.data.ipv6 ? ifObject.data.ipv6 : false,
        });
        return ipOutput;
    }

    const whatsMyIPList = [
        "https://api.ipify.org",
        "https://checkip.amazonaws.com",
        "https://icanhazip.com",
        "https://ifconfig.co/ip",
        "https://ipecho.net/plain",
        "https://ipinfo.io/ip",
    ] as const;

    const ipv4Set = new Set<string>();
    const ipv6Set = new Set<string>();

    const customKy = getKyInstance(proxy);

    for (const service of whatsMyIPList) {
        const kyResponse = await customKy.get(service);

        if (kyResponse.ok) {
            const pubIP = (await kyResponse.text()).trim();

            const ipv4Check = z.ipv4().safeParse(pubIP);
            const ipv6Check = z.ipv6().safeParse(pubIP);

            if (ipv4Check.success) {
                ipv4Set.add(ipv4Check.data);
            }
            if (ipv6Check.success) {
                ipv6Set.add(ipv6Check.data);
            }
        }
    }

    if (ipv4Set.size === 0 && ipv6Set.size === 0) {
        throw new Error("Failed to automatically get public IP");
    }

    const IPv4 = ipv4Set.values().next().value;
    const IPv6 = ipv6Set.values().next().value;

    const ipv4Output = z.ipv4().safeParse(IPv4);
    const ipv6Output = z.ipv6().safeParse(IPv6);

    const ipOutput = ipOutputObject.parse({
        ipv4: ipv4Output.success ? ipv4Output.data : false,
        ipv6: ipv6Output.success ? ipv6Output.data : false,
    });
    return ipOutput;
}
