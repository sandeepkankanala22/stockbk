import fs from 'fs/promises';
import path from 'path';
import type { StoredModel } from './LogisticModel.js';

const MODEL_DIR = path.resolve(process.cwd(), 'models');
const MODEL_FILE = path.join(MODEL_DIR, 'target_model.json');

class ModelStore {
  private cached: StoredModel | null = null;

  async save(model: StoredModel): Promise<void> {
    await fs.mkdir(MODEL_DIR, { recursive: true });
    await fs.writeFile(MODEL_FILE, JSON.stringify(model, null, 2), 'utf-8');
    this.cached = model;
  }

  async load(): Promise<StoredModel | null> {
    if (this.cached) return this.cached;
    try {
      const content = await fs.readFile(MODEL_FILE, 'utf-8');
      this.cached = JSON.parse(content) as StoredModel;
      return this.cached;
    } catch {
      return null;
    }
  }

  async clear(): Promise<void> {
    this.cached = null;
    try {
      await fs.unlink(MODEL_FILE);
    } catch {
      // ignore missing file
    }
  }

  getCached(): StoredModel | null {
    return this.cached;
  }
}

export const modelStore = new ModelStore();
