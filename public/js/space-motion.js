// Small fixed steps keep inertia consistent on phones and after an interrupted frame.
export class SpaceMotion {
  constructor(random = Math.random) {
    this.random = random;
    this.position = { x: 0, y: 0, z: 0 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.target = { x: 0, y: 0, z: 0 };
    this.remaining = 0;
    this.wanderTime = 0;
    this.spinWait = 12 + random() * 8;
    this.spinTime = -1;
    this.spinDuration = 5;
    this.roll = 0;
    this.pitch = 0;
    this.yaw = 0;
  }

  kick(x, y) {
    this.velocity.x += x;
    this.velocity.y += y;
  }

  update(delta, reduced, sleeping) {
    if (reduced) {
      for (const axis of ['x', 'y', 'z']) this.position[axis] = this.velocity[axis] = 0;
      this.roll = this.pitch = this.yaw = 0;
      this.spinTime = -1;
      return;
    }
    this.remaining += Math.min(Math.max(delta, 0), 0.1);
    const step = 1 / 120;
    while (this.remaining >= step - 1e-9) {
      this.remaining -= step;
      this.wanderTime -= step;
      if (!sleeping && this.wanderTime <= 0) {
        for (const axis of ['x', 'y', 'z']) this.target[axis] = (this.random() - 0.5) * 1.45;
        this.wanderTime = 3.5 + this.random() * 4;
      }
      for (const axis of ['x', 'y', 'z']) {
        const target = sleeping ? 0 : this.target[axis];
        this.velocity[axis] += ((target - this.position[axis]) * (sleeping ? 3.5 : 0.45) - this.velocity[axis] * (sleeping ? 3.6 : 0.8)) * step;
        this.position[axis] += this.velocity[axis] * step;
        if (Math.abs(this.position[axis]) > 1) {
          this.position[axis] = Math.sign(this.position[axis]);
          this.velocity[axis] *= -0.25;
        }
      }
      if (sleeping) {
        this.yaw *= Math.exp(-step * 6);
        this.roll = Math.atan2(Math.sin(this.roll), Math.cos(this.roll)) * Math.exp(-step * 6);
        this.pitch *= Math.exp(-step * 6);
        this.spinTime = -1;
        this.spinWait = Math.max(this.spinWait, 6);
      } else if (this.spinTime >= 0) {
        this.spinTime += step;
        const t = Math.min(this.spinTime / this.spinDuration, 1);
        const ease = t * t * t * (t * (t * 6 - 15) + 10);
        this.roll = this.spinDirection * Math.PI * 2 * ease;
        this.pitch = Math.sin(t * Math.PI) * 0.3;
        if (t === 1) {
          this.roll = this.pitch = 0;
          this.spinTime = -1;
          this.spinWait = 24 + this.random() * 18;
        }
      } else {
        this.spinWait -= step;
        if (this.spinWait <= 0) {
          this.spinTime = 0;
          this.spinDirection = this.random() > 0.5 ? 1 : -1;
          this.spinDuration = 4.8 + this.random() * 1.5;
        }
      }
      if (!sleeping && Math.hypot(this.velocity.x, this.velocity.z) > 0.015) {
        const heading = Math.atan2(this.velocity.x, this.velocity.z);
        this.yaw += Math.atan2(Math.sin(heading - this.yaw), Math.cos(heading - this.yaw)) * (1 - Math.exp(-step * 1.4));
      }
    }
  }
}
