const requiredMajor = 20;
const currentMajor = Number(process.versions.node.split('.')[0]);

if (Number.isNaN(currentMajor)) {
  console.warn('[node-version] Unable to determine current Node.js version.');
  process.exit(0);
}

if (currentMajor !== requiredMajor) {
  console.warn(
    `[node-version] Detected Node.js ${process.versions.node}. This project expects Node ${requiredMajor}.x.\n` +
      'Use one of the version managers below to switch quickly:\n' +
      '- nvm: nvm install 20 && nvm use 20\n' +
      '- nvm-windows: nvm install 20.0.0 && nvm use 20.0.0\n' +
      '- asdf: asdf install nodejs 20 && asdf local nodejs 20\n'
  );
}
