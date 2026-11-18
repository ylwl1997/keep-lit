import * as THREE from "three";
import { C, STAND_HEAD, PX_TO_WORLD } from "./constants";
import { makeMaterial, type GameTextures } from "./textures";

export type CharacterPose = "stand" | "cup" | "jump" | "vault" | "crawl" | "run";

const HEAD = STAND_HEAD * PX_TO_WORLD;

export class Character {
  readonly group = new THREE.Group();
  readonly candleLight: THREE.PointLight;
  readonly flameCoreLight: THREE.PointLight;
  readonly flameMeshes: THREE.Mesh[] = [];

  private readonly hip: THREE.Group;
  private readonly torso: THREE.Group;
  private readonly head: THREE.Group;
  private readonly coat: THREE.Mesh;
  private readonly lThigh: THREE.Group;
  private readonly rThigh: THREE.Group;
  private readonly lShin: THREE.Group;
  private readonly rShin: THREE.Group;
  private readonly lArm: THREE.Group;
  private readonly rArm: THREE.Group;
  private readonly lFore: THREE.Group;
  private readonly rFore: THREE.Group;
  private readonly stick: THREE.Group;
  private readonly flameRoot: THREE.Group;
  private readonly smoke: THREE.Group;
  private smokeMats: THREE.MeshBasicMaterial[] = [];

  constructor(textures: GameTextures) {
    const wood = makeMaterial(C.wood, textures, "wood");
    const copper = makeMaterial(C.copper, textures, "copper");
    const coatMat = new THREE.MeshStandardMaterial({
      color: C.coat,
      roughness: 0.86,
      metalness: 0,
    });
    const coatRim = new THREE.MeshStandardMaterial({
      color: C.coatRim,
      roughness: 0.82,
      metalness: 0,
    });
    const pants = new THREE.MeshStandardMaterial({
      color: C.pants,
      roughness: 0.88,
      metalness: 0,
    });
    const skin = new THREE.MeshStandardMaterial({
      color: C.skin,
      roughness: 0.7,
      metalness: 0,
    });
    const hair = new THREE.MeshStandardMaterial({
      color: C.hair,
      roughness: 0.9,
      metalness: 0,
    });

    this.hip = new THREE.Group();
    this.hip.position.y = 0.74;
    this.group.add(this.hip);

    this.torso = new THREE.Group();
    this.torso.position.y = 0.08;
    this.hip.add(this.torso);

    this.coat = mesh(0.42, 0.72, 0.32, coatMat, 0, 0.28, 0);
    this.torso.add(this.coat);
    // Mid-thigh hem flare and collar for a readable coat silhouette.
    this.torso.add(mesh(0.48, 0.12, 0.36, coatMat, 0, -0.08, 0.01));
    this.torso.add(mesh(0.36, 0.1, 0.28, coatRim, 0, 0.62, 0.02));
    this.torso.add(mesh(0.22, 0.16, 0.08, coatMat, 0, 0.52, 0.16));

    this.head = new THREE.Group();
    this.head.position.set(0, 0.78, 0);
    this.torso.add(this.head);
    this.head.add(mesh(0.22, 0.24, 0.2, skin, 0, 0.08, 0.01));
    this.head.add(mesh(0.24, 0.16, 0.22, hair, 0, 0.2, -0.01));
    this.head.add(mesh(0.08, 0.08, 0.16, hair, 0, 0.1, -0.1));

    this.lArm = new THREE.Group();
    this.rArm = new THREE.Group();
    this.lArm.position.set(0.24, 0.52, 0);
    this.rArm.position.set(-0.24, 0.52, 0.02);
    this.torso.add(this.lArm, this.rArm);
    this.lArm.add(mesh(0.1, 0.32, 0.1, coatMat, 0, -0.16, 0));
    this.rArm.add(mesh(0.1, 0.32, 0.1, coatMat, 0, -0.16, 0));
    this.lFore = new THREE.Group();
    this.rFore = new THREE.Group();
    this.lFore.position.set(0, -0.32, 0);
    this.rFore.position.set(0, -0.32, 0);
    this.lArm.add(this.lFore);
    this.rArm.add(this.rFore);
    this.lFore.add(mesh(0.09, 0.3, 0.09, coatMat, 0, -0.14, 0));
    this.rFore.add(mesh(0.09, 0.3, 0.09, coatMat, 0, -0.14, 0));
    const lHand = mesh(0.08, 0.08, 0.08, skin, 0, -0.3, 0);
    const rHand = mesh(0.08, 0.08, 0.08, skin, 0, -0.3, 0);
    this.lFore.add(lHand);
    this.rFore.add(rHand);

    this.stick = new THREE.Group();
    this.stick.position.set(0.02, -0.32, 0.08);
    this.rFore.add(this.stick);
    this.stick.add(mesh(0.045, 0.28, 0.045, copper, 0, 0.16, 0));
    this.stick.add(mesh(0.1, 0.04, 0.1, copper, 0, 0.02, 0));
    this.stick.add(mesh(0.06, 0.05, 0.06, copper, 0, 0.3, 0));
    const wax = mesh(0.04, 0.1, 0.04, new THREE.MeshStandardMaterial({
      color: 0xe8d8b8,
      roughness: 0.7,
      metalness: 0,
    }), 0, 0.38, 0);
    this.stick.add(wax);
    const wick = mesh(0.01, 0.04, 0.01, new THREE.MeshStandardMaterial({
      color: 0x1a120c,
      roughness: 1,
      metalness: 0,
    }), 0, 0.45, 0);
    this.stick.add(wick);

    this.flameRoot = new THREE.Group();
    this.flameRoot.position.set(0, 0.5, 0);
    this.stick.add(this.flameRoot);
    const coreMat = new THREE.MeshStandardMaterial({
      color: C.flameCore,
      emissive: C.flameCore,
      emissiveIntensity: 4.2,
      roughness: 1,
      metalness: 0,
      toneMapped: false,
    });
    const midMat = new THREE.MeshStandardMaterial({
      color: C.flameMid,
      emissive: C.flame,
      emissiveIntensity: 2.4,
      roughness: 1,
      metalness: 0,
      toneMapped: false,
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), coreMat);
    const mid = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 8), midMat);
    mid.position.y = 0.07;
    this.flameRoot.add(core, mid);
    this.flameMeshes.push(core, mid);

    this.candleLight = new THREE.PointLight(C.flameBounce, 2.7, 9, 2);
    this.candleLight.castShadow = true;
    this.candleLight.shadow.mapSize.set(1024, 1024);
    this.candleLight.shadow.bias = -0.0004;
    this.candleLight.shadow.normalBias = 0.03;
    this.candleLight.shadow.camera.near = 0.1;
    this.candleLight.shadow.camera.far = 10;
    this.flameRoot.add(this.candleLight);

    this.flameCoreLight = new THREE.PointLight(C.flameCore, 1.4, 2.2, 2);
    this.flameRoot.add(this.flameCoreLight);

    this.lThigh = new THREE.Group();
    this.rThigh = new THREE.Group();
    this.lThigh.position.set(0.1, 0, 0);
    this.rThigh.position.set(-0.1, 0, 0);
    this.hip.add(this.lThigh, this.rThigh);
    this.lThigh.add(mesh(0.14, 0.38, 0.16, pants, 0, -0.18, 0));
    this.rThigh.add(mesh(0.14, 0.38, 0.16, pants, 0, -0.18, 0));
    this.lShin = new THREE.Group();
    this.rShin = new THREE.Group();
    this.lShin.position.set(0, -0.38, 0);
    this.rShin.position.set(0, -0.38, 0);
    this.lThigh.add(this.lShin);
    this.rThigh.add(this.rShin);
    this.lShin.add(mesh(0.12, 0.36, 0.14, pants, 0, -0.16, 0));
    this.rShin.add(mesh(0.12, 0.36, 0.14, pants, 0, -0.16, 0));
    this.lShin.add(mesh(0.13, 0.1, 0.22, pants, 0, -0.36, 0.04));
    this.rShin.add(mesh(0.13, 0.1, 0.22, pants, 0, -0.36, 0.04));

    this.smoke = new THREE.Group();
    this.smoke.visible = false;
    this.flameRoot.add(this.smoke);
    const smokeMat = () =>
      new THREE.MeshBasicMaterial({
        color: 0xb0a090,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      });
    for (let i = 0; i < 4; i++) {
      const mat = smokeMat();
      this.smokeMats.push(mat);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.03 + i * 0.01, 8, 6), mat);
      p.position.set((i - 1.5) * 0.02, 0.06 + i * 0.07, 0);
      this.smoke.add(p);
    }

    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    for (const f of this.flameMeshes) {
      f.castShadow = false;
      f.receiveShadow = false;
    }

    // Wood candlestick collar already added; tiny unused ref keeps wood used.
    this.stick.add(mesh(0.03, 0.02, 0.03, wood, 0, 0.08, 0));

    this.setPose("stand", 0, 0, 0, 0);
  }

  get height(): number {
    return HEAD;
  }

  setPose(
    pose: CharacterPose,
    walkPhase: number,
    leanX: number,
    leanY: number,
    timeSec: number,
  ): void {
    const stride = Math.sin(walkPhase);
    const strideC = Math.cos(walkPhase);

    this.hip.position.set(0, 0.74, 0);
    this.hip.rotation.set(0, 0, 0);
    this.torso.rotation.set(0, 0, 0);
    this.head.position.set(0, 0.78, 0);
    this.head.rotation.set(0, 0, 0);
    this.coat.rotation.set(0, 0, 0);
    this.lArm.rotation.set(0, 0, 0.18);
    this.rArm.rotation.set(0, 0, -0.18);
    this.lFore.rotation.set(-0.15, 0, 0);
    this.rFore.rotation.set(-0.2, 0, 0);
    this.lThigh.rotation.set(0, 0, 0);
    this.rThigh.rotation.set(0, 0, 0);
    this.lShin.rotation.set(0.08, 0, 0);
    this.rShin.rotation.set(0.08, 0, 0);
    this.stick.rotation.set(0, 0, 0);
    this.group.rotation.set(0, 0.15, 0);

    if (pose === "stand") {
      this.lThigh.rotation.x = stride * 0.35;
      this.rThigh.rotation.x = -stride * 0.35;
      this.lShin.rotation.x = 0.1 + Math.max(0, -stride) * 0.25;
      this.rShin.rotation.x = 0.1 + Math.max(0, stride) * 0.25;
      this.lArm.rotation.x = -stride * 0.28;
      this.rArm.rotation.x = stride * 0.18;
      this.rFore.rotation.x = -0.35;
      this.hip.position.y = 0.74 + Math.abs(stride) * 0.015;
    } else if (pose === "cup") {
      this.hip.position.y = 0.58;
      this.torso.rotation.x = 0.18;
      this.head.rotation.x = -0.2;
      this.lArm.rotation.set(-0.9, 0.15, 0.7);
      this.rArm.rotation.set(-0.85, -0.1, -0.7);
      this.lFore.rotation.set(-0.7, 0.4, 0);
      this.rFore.rotation.set(-0.65, -0.35, 0);
      this.lThigh.rotation.x = 0.55 + stride * 0.12;
      this.rThigh.rotation.x = 0.5 - stride * 0.12;
      this.lShin.rotation.x = 0.55;
      this.rShin.rotation.x = 0.55;
      this.stick.rotation.set(-0.15, 0, 0);
    } else if (pose === "jump") {
      this.hip.position.y = 0.82;
      this.torso.rotation.x = -0.1;
      this.lThigh.rotation.x = -0.45;
      this.rThigh.rotation.x = 0.35;
      this.lShin.rotation.x = 0.85;
      this.rShin.rotation.x = 0.7;
      this.lArm.rotation.set(-0.6, 0, 0.4);
      this.rArm.rotation.set(0.2, 0, -0.25);
      this.rFore.rotation.x = -0.3;
    } else if (pose === "vault") {
      this.hip.position.set(0.1, 0.7, 0);
      this.hip.rotation.z = -0.15;
      this.torso.rotation.set(0.85, 0.2, -0.35);
      this.head.rotation.x = -0.2;
      this.lArm.rotation.set(-1.3, 0.2, 0.3);
      this.rArm.rotation.set(-0.4, -0.3, -1.1);
      this.lFore.rotation.x = -0.3;
      this.rFore.rotation.x = -0.2;
      this.lThigh.rotation.set(0.9, 0, 0.15);
      this.rThigh.rotation.set(-0.35, 0, -0.2);
      this.lShin.rotation.x = 0.7;
      this.rShin.rotation.x = 0.2;
      this.group.rotation.y = 0.35;
    } else if (pose === "crawl") {
      this.hip.position.set(0.15, 0.28, 0);
      this.torso.rotation.set(1.15, 0, 0);
      this.head.rotation.x = -0.7;
      this.head.position.set(0, 0.72, 0.08);
      this.lArm.rotation.set(-1.4, 0, 0.35);
      this.rArm.rotation.set(-1.15, 0, -0.2);
      this.lFore.rotation.x = -0.35;
      this.rFore.rotation.x = -0.2;
      this.lThigh.rotation.set(1.15, 0, 0.1);
      this.rThigh.rotation.set(0.85, 0, -0.1);
      this.lShin.rotation.x = 1.1;
      this.rShin.rotation.x = 1.05;
      this.stick.rotation.set(0.4, 0, 0);
      this.group.rotation.y = 0.05;
    } else if (pose === "run") {
      this.hip.position.y = 0.78 + Math.abs(stride) * 0.03;
      this.torso.rotation.x = 0.35;
      this.head.rotation.x = -0.12;
      this.lThigh.rotation.x = stride * 0.95;
      this.rThigh.rotation.x = -stride * 0.95;
      this.lShin.rotation.x = 0.2 + Math.max(0, -stride) * 0.7;
      this.rShin.rotation.x = 0.2 + Math.max(0, stride) * 0.7;
      this.lArm.rotation.x = -stride * 0.8;
      this.rArm.rotation.x = stride * 0.45;
      this.lArm.rotation.z = 0.25;
      this.rArm.rotation.z = -0.15;
      this.coatSwing(strideC * 0.12);
    }

    this.torso.rotation.z += leanX * 0.18;
    this.torso.rotation.x += -leanY * 0.12;
    this.flickerFlame(timeSec, pose !== "vault");
  }

  setLit(on: boolean, intensity = 1): void {
    this.flameRoot.visible = on;
    this.smoke.visible = !on;
    const k = on ? Math.max(0.2, intensity) : 0.22;
    this.candleLight.intensity = on ? 2.7 * k : 0.32;
    this.flameCoreLight.intensity = on ? 1.4 * k : 0;
    this.candleLight.distance = on ? 9 : 6;
  }

  updateSmoke(dt: number, timeSec: number): void {
    if (!this.smoke.visible) return;
    for (let i = 0; i < this.smoke.children.length; i++) {
      const p = this.smoke.children[i] as THREE.Mesh;
      p.position.y += dt * (0.25 + i * 0.08);
      p.position.x = Math.sin(timeSec * 2 + i) * 0.04;
      p.scale.setScalar(1 + (p.position.y - 0.06) * 2);
      const mat = this.smokeMats[i];
      if (mat) mat.opacity = Math.max(0, 0.4 - p.position.y * 0.7);
      if (p.position.y > 0.55) {
        p.position.y = 0.05;
        p.scale.setScalar(1);
      }
    }
  }

  private coatSwing(amount: number): void {
    this.coat.rotation.x = amount;
  }

  private flickerFlame(timeSec: number, cupped: boolean): void {
    const f =
      Math.sin(timeSec * 21) * 0.45 +
      Math.sin(timeSec * 37 * 1.7) * 0.32 +
      Math.sin(timeSec * 59 * 0.4) * 0.23;
    const s = 1 + f * (cupped ? 0.06 : 0.14);
    this.flameRoot.scale.set(s, 1 + f * 0.18, s);
    this.flameRoot.position.x = f * 0.01;
  }
}

function mesh(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}
