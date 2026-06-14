import Reveal from '@/components/anim/Reveal';
import Stars from '@/components/svg/Stars';
import { Globe, MapPin, Star } from '@/components/svg/Icons';
import { KC, SerifNum } from '@/constants/theme';
import { formatPrice } from '@/utils/format';
import type { StoreInfo } from '@/utils/gemini';
import type { PlaceResult } from '@/utils/place';
import { ActivityIndicator, Linking, Platform, Text, TouchableOpacity, View } from 'react-native';

// djhh:中文段落词级断行 + 末行防孤字(RN-web 透传到 DOM)
const CJK = Platform.OS === 'web' ? ({ wordBreak: 'keep-all', overflowWrap: 'break-word', textWrap: 'pretty' } as any) : {};
const NOWRAP = Platform.OS === 'web' ? ({ whiteSpace: 'nowrap' } as any) : {};

const PRICE_LEVEL_LABEL = ['免费', '实惠', '适中', '偏高', '很高'];

/** 数据来源徽章配色 */
function sourceBadge(source: 'amap' | 'google' | 'ai') {
    if (source === 'amap') return { label: '高德地图', color: KC.scan };
    if (source === 'google') return { label: 'Google', color: '#8AB4F8' };
    return { label: 'AI 参考', color: KC.amber };
}

interface StoreCardProps {
    /** AI 识别出的店铺(用于店名/城市/AI 口碑兜底) */
    store: StoreInfo | null;
    /** /api/place 查到的真实口碑;无则 null */
    place: PlaceResult | null;
    loading: boolean;
    region: 'domestic' | 'overseas';
    /** 是否可发起设备定位(web + 浏览器支持 + 尚未用定位) */
    canLocate: boolean;
    locating: boolean;
    onUseLocation: () => void;
    /** 查询失败/未配置原因(仅用于细化文案) */
    reason?: string;
}

export default function StoreCard({ store, place, loading, region, canLocate, locating, onUseLocation, reason }: StoreCardProps) {
    const displayName = place?.name || store?.name || '这家店';
    const hasRating = !!place && place.rating != null;
    const aiNote = store?.reputationNote || null;

    // 决定来源徽章:真实数据用 amap/google,否则 AI 兜底
    const badge = place ? sourceBadge(place.source) : sourceBadge('ai');
    const accent = badge.color;

    const locationBtn = canLocate ? (
        <TouchableOpacity
            onPress={onUseLocation}
            disabled={locating}
            accessibilityRole="button"
            accessibilityLabel="用设备定位让店铺识别更准"
            className="flex-row items-center self-start mt-3 px-3 py-1.5 rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' }}
        >
            {locating
                ? <ActivityIndicator size="small" color={KC.textMid} />
                : <MapPin size={13} color={KC.goldSoft} />}
            <Text className="text-[11px] font-bold ml-1.5" style={{ color: KC.goldSoft }}>
                {locating ? '定位中…' : '用定位更准'}
            </Text>
        </TouchableOpacity>
    ) : null;

    return (
        <Reveal delay={40}>
            <View
                className="rounded-[24px] border px-5 pt-4 pb-4 mb-3.5 overflow-hidden"
                style={{ backgroundColor: 'rgba(12,8,22,0.72)', borderColor: `${accent}4D` }}
            >
                {/* 顶部色辉 */}
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, backgroundColor: accent, opacity: 0.85 }} />

                {/* 头部:图标 + 店名 + 来源徽章 */}
                <View className="flex-row items-start justify-between">
                    <View className="flex-row items-start flex-1 mr-3">
                        <View style={{ marginTop: 2, marginRight: 9 }}>
                            {region === 'overseas' ? <Globe size={18} color={accent} /> : <MapPin size={18} color={accent} />}
                        </View>
                        <View className="flex-1">
                            <Text className="text-[10px] font-black tracking-[0.25em] mb-0.5" style={{ color: accent }}>
                                店 铺 口 碑
                            </Text>
                            <Text className="font-black text-[16px] leading-snug" style={[{ color: KC.textHi }, CJK]} numberOfLines={2}>
                                {displayName}
                            </Text>
                        </View>
                    </View>
                    <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: `${accent}22`, borderWidth: 1, borderColor: `${accent}55` }}>
                        <Text className="text-[10px] font-black" style={[{ color: accent }, NOWRAP]}>{badge.label}</Text>
                    </View>
                </View>

                {/* 主体 */}
                {loading ? (
                    <View className="flex-row items-center mt-4">
                        <ActivityIndicator size="small" color={accent} />
                        <Text className="text-[12px] ml-2.5" style={{ color: KC.textMid }}>正在查询店铺口碑…</Text>
                    </View>
                ) : hasRating ? (
                    <>
                        {/* 评分行 */}
                        <View className="flex-row items-center mt-3.5">
                            <Text className="font-black" style={[{ color: KC.gold, fontFamily: SerifNum, fontSize: 34, lineHeight: 36 }, NOWRAP]}>
                                {place!.rating!.toFixed(1)}
                            </Text>
                            <Text className="text-[12px] font-bold mb-1 ml-1" style={{ color: KC.textLow }}>/ {place!.ratingScale}</Text>
                            <View className="ml-3">
                                <Stars rating={(place!.rating! / place!.ratingScale) * 10} size={14} />
                                {place!.reviewCount != null && (
                                    <Text className="text-[11px] mt-1 num" style={{ color: KC.textMid }}>
                                        {formatPrice(place!.reviewCount)} 条评价
                                    </Text>
                                )}
                            </View>
                        </View>

                        {/* 人均 / 价位 */}
                        {(place!.cost != null || place!.priceLevel != null) && (
                            <View className="flex-row flex-wrap mt-3" style={{ gap: 8 }}>
                                {place!.cost != null && (
                                    <View className="px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                                        <Text className="text-[12px] font-bold num" style={{ color: KC.goldSoft }}>人均 ¥{formatPrice(place!.cost)}</Text>
                                    </View>
                                )}
                                {place!.priceLevel != null && (
                                    <View className="px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                                        <Text className="text-[12px] font-bold" style={{ color: KC.goldSoft }}>
                                            价位 · {PRICE_LEVEL_LABEL[place!.priceLevel] || '—'}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* 地址 */}
                        {!!place!.address && (
                            <View className="flex-row items-start mt-3">
                                <View style={{ marginTop: 1, marginRight: 7 }}><MapPin size={13} color={KC.textLow} /></View>
                                <Text className="flex-1 text-[12px]" style={[{ color: KC.textMid, lineHeight: 18 }, CJK]} numberOfLines={2}>
                                    {place!.address}
                                </Text>
                            </View>
                        )}

                        {/* Google 详情链接 */}
                        {!!place!.url && Platform.OS === 'web' && (
                            <TouchableOpacity onPress={() => Linking.openURL(place!.url!)} className="self-start mt-2.5">
                                <Text className="text-[12px] font-bold" style={{ color: accent, textDecorationLine: 'underline' }}>
                                    在 Google 地图查看 ↗
                                </Text>
                            </TouchableOpacity>
                        )}
                    </>
                ) : aiNote ? (
                    /* 没查到真实评分 → AI 自带知识的参考口碑 */
                    <>
                        <View className="flex-row items-start mt-3.5 rounded-xl px-3.5 py-3" style={{ backgroundColor: 'rgba(255,194,75,0.08)', borderLeftWidth: 2, borderLeftColor: KC.amber }}>
                            <View style={{ marginTop: 1, marginRight: 8 }}><Star size={15} color={KC.amber} /></View>
                            <Text className="flex-1 text-[13px] font-medium" style={[{ color: KC.textHi, lineHeight: 20 }, CJK]}>{aiNote}</Text>
                        </View>
                        <Text className="text-[10px] mt-2" style={{ color: KC.textLow }}>
                            * AI 依据公开知识的参考印象,非实时评分{region === 'overseas' ? ';配置 Google key 后显示实时评分' : ''}
                        </Text>
                    </>
                ) : (
                    /* 啥也没查到 */
                    <Text className="text-[12px] mt-3.5" style={[{ color: KC.textMid, lineHeight: 19 }, CJK]}>
                        {region === 'overseas' && reason === 'no_google_key'
                            ? '境外实时评分需配置 Google key;暂未找到该店的公开口碑。'
                            : '暂未找到该店的公开评价,换一张能看清门头/店名的照片可能更准。'}
                    </Text>
                )}

                {locationBtn}
            </View>
        </Reveal>
    );
}
