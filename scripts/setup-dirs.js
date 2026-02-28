import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const dirsToCreate = ['db', 'uploads', 'logs'];

dirsToCreate.forEach(dir => {
  const dirPath = path.join(projectRoot, dir);
  if (!fs.existsSync(dirPath)) {
    console.log(`Creating directory: ${dirPath}`);
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

console.log('Directory setup complete.');
