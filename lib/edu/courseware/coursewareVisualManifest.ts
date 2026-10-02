import manifest from './coursewareR2VisualManifest.json';

export type VisualSceneType = 'intro'|'story'|'theory'|'interaction'|'notebook'|'reflection'|'completion';
export type VisualAsset = { key:string; url?:string; group:string; day?:number; sceneType?:VisualSceneType|string; fallbackGradient:string; isPlaceholder:boolean };

type ManifestAsset = { key:string; group:string; day?:number; sceneType?:string; path?:string };

const BASE = process.env.NEXT_PUBLIC_EDU_VISUAL_ASSET_BASE_URL ?? manifest.baseUrl ?? '';
const withBase = (path?: string) => path ? `${BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}` : undefined;

const assets = (manifest.assets as ManifestAsset[]).map((asset) => ({ ...asset, url: withBase(asset.path) }));

const fallbackGradientByScene: Record<string, string> = {
  intro: 'linear-gradient(135deg,#1e3a8a 0%,#0f766e 100%)',
  story: 'linear-gradient(135deg,#312e81 0%,#155e75 100%)',
  theory: 'linear-gradient(180deg,#eef2ff 0%,#dbeafe 100%)',
  interaction: 'linear-gradient(180deg,#dbeafe 0%,#cffafe 100%)',
  notebook: 'linear-gradient(180deg,#f0fdf4 0%,#ecfeff 100%)',
  reflection: 'linear-gradient(180deg,#ede9fe 0%,#dbeafe 100%)',
  completion: 'linear-gradient(180deg,#312e81 0%,#0f172a 100%)',
  default: 'linear-gradient(180deg,#e2e8f0 0%,#cbd5e1 100%)'
};

const placeholder = (sceneType: string): VisualAsset => ({ key: `placeholder.${sceneType}`, group:'placeholder', sceneType, fallbackGradient: fallbackGradientByScene[sceneType] ?? fallbackGradientByScene.default, isPlaceholder:true });

export const getVisualForDayScene = (day:number, sceneType:VisualSceneType): VisualAsset => {
  const byDayScene = assets.find((asset) => asset.day===day && asset.sceneType===sceneType);
  const byDay = assets.find((asset) => asset.day===day);
  const byGlobal = assets.find((asset) => asset.key===`global.${sceneType}`) ?? assets.find((asset) => asset.key==='global.stage');
  const selected = byDayScene ?? byDay ?? byGlobal;
  if (!selected) return placeholder(sceneType);
  return { key:selected.key, url:selected.url, group:selected.group, day:selected.day, sceneType:selected.sceneType, fallbackGradient:fallbackGradientByScene[sceneType] ?? fallbackGradientByScene.default, isPlaceholder:!selected.url };
};

export const validateDecorativeAssetHosts = () => assets.every((asset) => !(asset.url ?? '').includes('models.gomdory.com'));
export const getManifestAssetCount = () => assets.length;
