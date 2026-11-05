import { Schema, MapSchema, defineTypes } from '@colyseus/schema';

export class PlayerState extends Schema {
  constructor() {
    super();
    this.userId = '';
    this.name = '';
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.ry = 0;
    this.speed = 0;
    this.car = 'red';
    this.carrying = -1;   // biome index of the egg on board, -1 = none
    this.nitro = false;
  }
}
defineTypes(PlayerState, {
  userId: 'string',
  name: 'string',
  x: 'float32',
  y: 'float32',
  z: 'float32',
  ry: 'float32',
  speed: 'float32',
  car: 'string',
  carrying: 'int8',
  nitro: 'boolean',
});

export class RoadsterState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
  }
}
defineTypes(RoadsterState, { players: { map: PlayerState } });
