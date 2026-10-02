import "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      color: any;
      fog: any;
      ambientLight: any;
      directionalLight: any;
      mesh: any;
      planeGeometry: any;
      meshStandardMaterial: any;
      boxGeometry: any;
      ringGeometry: any;
      meshBasicMaterial: any;
      group: any;
      capsuleGeometry: any;
      sphereGeometry: any;
    }
  }
}
