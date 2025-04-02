import {
  Service,
  Params,
  Id,
  NullableId,
  ServiceMethods,
  ServiceAddons,
  Application,
} from '@feathersjs/feathers';
import { EventEmitter } from 'events';
import { mockConfig } from '../queue.fixtures';
import { QueueService } from '../../src/queue/queue.class';
import { PubSub } from '@google-cloud/pubsub';

export type TestService = ServiceMethods<any> & Service & EventEmitter & ServiceAddons<any>;

export interface TestConfig {
  projectId: string;
  apiEndpoint: string;
  queues: Record<string, any>;
}

// Create a base service that implements all required methods
class BaseService implements ServiceMethods<any> {
  async find(_params?: Params) {
    return [];
  }

  async get(_id: Id, _params?: Params) {
    return {};
  }

  async create(_data: any, _params?: Params) {
    return {};
  }

  async update(_id: NullableId, _data: any, _params?: Params) {
    return {};
  }

  async patch(_id: NullableId, _data: any, _params?: Params) {
    return {};
  }

  async remove(_id: NullableId, _params?: Params) {
    return {};
  }
}

export class TestApplication extends EventEmitter {
  public _services: { [key: string]: any };
  public settings: { [key: string]: any };
  public _isSetup: boolean;
  public defaultService: (location: string) => any;
  public hooks: any;
  public version: string;
  public mixins: any[];
  public services: { [key: string]: any };
  private _pubsub: PubSub;

  constructor() {
    super();
    this._services = {};
    this.settings = {};
    this._isSetup = false;
    this.version = '1.0.0';
    this.mixins = [];
    this.services = this._services;
    this._pubsub = new PubSub({ projectId: mockConfig.projectId });
    this.defaultService = (location: string) => {
      return this._services[location] || {};
    };
    this.hooks = {};
  }

  use(location: string, service: any) {
    this._services[location] = service;
    return this;
  }

  service(location: string): any {
    if (!this._services[location]) {
      this._services[location] = new BaseService();
    }
    return this._services[location];
  }

  setup(): Promise<this> {
    this._isSetup = true;
    return Promise.resolve(this);
  }

  get(name: string): any {
    return mockConfig;
  }

  set(name: string, value: any): this {
    this.settings[name] = value;
    return this;
  }

  get pubsub(): PubSub {
    return this._pubsub;
  }

  configure(callback: (this: this, app: this) => void): this {
    callback.call(this, this);
    return this;
  }

  teardown(): Promise<this> {
    this._isSetup = false;
    return Promise.resolve(this);
  }

  unuse(path: string): Promise<any> {
    return Promise.resolve(this._services[path]);
  }
}

export async function createTestApp(serviceName: string = 'pubsub'): Promise<TestApplication> {
  const app = new TestApplication();
  const queueService = new MockQueueService();
  app.use(serviceName, queueService);
  return app;
}

export function createFailingTestApp(error: Error): TestApplication {
  const app = new TestApplication();
  const failingService = {
    find: async () => {
      throw error;
    },
    get: async () => {
      throw error;
    },
    create: async () => {
      throw error;
    },
    update: async () => {
      throw error;
    },
    patch: async () => {
      throw error;
    },
    remove: async () => {
      throw error;
    }
  };
  app.use('queue', failingService);
  return app;
}

export class MockQueueService implements ServiceMethods<any> {
  async find(_params?: any) {
    return [];
  }

  async get(_id: string, _params?: any) {
    return null;
  }

  async create(_data: any, _params?: any) {
    return {};
  }

  async update(_id: string, _data: any, _params?: any) {
    return {};
  }

  async patch(_id: string, _data: any, _params?: any) {
    return {};
  }

  async remove(_id: string, _params?: any) {
    return {};
  }
}
