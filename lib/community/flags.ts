const COMMUNITY_3D_FLAG = "1";

export function isCommunity3DGalleryEnabled() {
  return process.env.NEXT_PUBLIC_COMMUNITY_3D_GALLERY === COMMUNITY_3D_FLAG;
}
