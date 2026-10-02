exports.Canvas = function Canvas(props) { return props && props.children ? props.children : null; };
exports.useFrame = function useFrame() {};
exports.useThree = function useThree() { return { camera: null, scene: null, gl: null }; };
