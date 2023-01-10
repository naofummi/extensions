import * as child_process from 'child_process';

async function isFinderRunning(): Promise<boolean> {
  try {
    await child_process.exec(`pgrep Finder`);
    return true;
  } catch (error) {
    return false;
  }
}

export default async function main() {
  const running = await isFinderRunning();
  if (running) {
    child_process.spawn('open', ['-a', 'Finder']);
  }
  child_process.spawn('open', ['-a', 'Finder']);
}
