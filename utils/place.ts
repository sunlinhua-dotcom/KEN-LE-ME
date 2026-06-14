/**
 * 店铺口碑客户端 —— 调服务端 /api/place(境内高德 / 境外 Google)。
 * 同时提供「境内/境外」判定与(web)可选定位。
 * web 同源走相对路径;原生 App 设 EXPO_PUBLIC_API_BASE 指向部署源站。
 */
import { Platform } from 'react-native';
import type { StoreInfo } from './gemini';

const BASE = process.env.EXPO_PUBLIC_API_BASE || '';

export interface PlaceResult {
    source: 'amap' | 'google';
    name: string;
    /** 评分(0–5);无则 null */
    rating: number | null;
    ratingScale: number;
    /** 评论数(Google 有,高德无) */
    reviewCount: number | null;
    /** 价位档 0–4(Google) */
    priceLevel: number | null;
    /** 人均(元,高德) */
    cost: number | null;
    address: string | null;
    type: string | null;
    tel: string | null;
    /** 详情链接(Google 地图) */
    url: string | null;
    city: string | null;
}

export interface PlaceLookup {
    ok: boolean;
    place: PlaceResult | null;
    source?: 'amap' | 'google' | null;
    reason?: string;
}

export interface Coords { lat: number; lng: number; }

/** 中国大陆(含港澳台)粗略经纬度范围 */
export function inChina(lat: number, lng: number): boolean {
    return lat >= 18 && lat <= 53.6 && lng >= 73.4 && lng <= 135.1;
}

/** 判定境内 / 境外:定位优先,其次 AI 识别的 region,最后按币种 */
export function decideRegion(
    store: StoreInfo | null | undefined,
    coords: Coords | null,
    currency?: string,
): 'domestic' | 'overseas' {
    if (coords) return inChina(coords.lat, coords.lng) ? 'domestic' : 'overseas';
    if (store?.region === 'domestic' || store?.region === 'overseas') return store.region;
    return currency && currency.toUpperCase() !== 'CNY' ? 'overseas' : 'domestic';
}

/** 查询店铺口碑 */
export async function lookupStore(params: {
    name: string;
    city?: string | null;
    country?: string | null;
    region: 'domestic' | 'overseas';
    coords?: Coords | null;
}): Promise<PlaceLookup> {
    const q = new URLSearchParams();
    q.set('name', params.name);
    if (params.city) q.set('city', params.city);
    if (params.country) q.set('country', params.country);
    q.set('region', params.region);
    if (params.coords) {
        q.set('lat', String(params.coords.lat));
        q.set('lng', String(params.coords.lng));
    }
    try {
        const r = await fetch(`${BASE}/api/place?${q.toString()}`);
        const d = await r.json().catch(() => null);
        if (d && typeof d.ok === 'boolean') return d as PlaceLookup;
        return { ok: false, place: null, reason: 'bad_response' };
    } catch {
        return { ok: false, place: null, reason: 'network' };
    }
}

/**
 * 请求一次设备定位(仅 web;原生未装 expo-location → 直接返回 null)。
 * 由用户主动点「用定位更准」时调用,平时不弹权限框。
 */
export function requestGeo(): Promise<Coords | null> {
    return new Promise((resolve) => {
        if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.geolocation) {
            return resolve(null);
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve(null),
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
        );
    });
}

/** 当前环境是否支持「用定位更准」(web + 浏览器有 geolocation) */
export const GEO_SUPPORTED =
    Platform.OS === 'web' && typeof navigator !== 'undefined' && !!navigator.geolocation;
