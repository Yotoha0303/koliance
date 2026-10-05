'use client'

import React, { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Sparkles, Float } from '@react-three/drei'
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'

// -------------------------------------------------------------
// 1. 内部发光能量源：白/青高亮光球 + 能量核聚光灯
// -------------------------------------------------------------
function EnergyCenter() {
  const coreRef = useRef<THREE.Mesh>(null!)
  const innerLightRef = useRef<THREE.PointLight>(null!)

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    // 能量脉冲呼吸缩放
    const scale = 1 + Math.sin(t * 5) * 0.08
    if (coreRef.current) {
      coreRef.current.scale.set(scale, scale, scale)
    }
    if (innerLightRef.current) {
      innerLightRef.current.intensity = 18 + Math.sin(t * 7) * 6
    }
  })

  return (
    <group>
      {/* 极高亮度的白青色发光核心球体 (toneMapped={false} 激发 Bloom) */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.36, 32, 32]} />
        <meshBasicMaterial color="#d4f7ff" toneMapped={false} />
      </mesh>

      {/* 核心外层青光晕 */}
      <mesh scale={0.58}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color="#00ffff"
          transparent
          opacity={0.38}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* 内部高亮青蓝点光源 */}
      <pointLight ref={innerLightRef} color="#00ffff" distance={10} decay={2} intensity={18} />
      {/* 互补紫色漫反射内胆光 */}
      <pointLight color="#a855f7" distance={7} decay={2} intensity={10} />
    </group>
  )
}

// -------------------------------------------------------------
// 2. 核心几何体（双层嵌套 Icosahedron + 霓虹线框 + 顶点发光晶核）
// -------------------------------------------------------------
function PolyhedronShell() {
  const outerRef = useRef<THREE.Group>(null!)
  const innerRef = useRef<THREE.Group>(null!)

  // 构建二十面体几何体及去重顶点
  const { geometry, vertices } = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1.65, 0)
    const pos = geo.attributes.position
    const pts: [number, number, number][] = []
    const map = new Set<string>()

    for (let i = 0; i < pos.count; i++) {
      const key = `${pos.getX(i).toFixed(2)},${pos.getY(i).toFixed(2)},${pos.getZ(i).toFixed(2)}`
      if (!map.has(key)) {
        map.add(key)
        pts.push([pos.getX(i), pos.getY(i), pos.getZ(i)])
      }
    }
    return { geometry: geo, vertices: pts }
  }, [])

  // 提取线框几何体
  const wireGeometry = useMemo(() => new THREE.WireframeGeometry(geometry), [geometry])

  useFrame((_, delta) => {
    if (outerRef.current) {
      // 外层平滑缓动自转
      outerRef.current.rotation.x += delta * 0.16
      outerRef.current.rotation.y += delta * 0.22
    }
    if (innerRef.current) {
      // 内层反向微倾自转，营造量子层叠错落感
      innerRef.current.rotation.x -= delta * 0.26
      innerRef.current.rotation.z += delta * 0.18
    }
  })

  return (
    <>
      {/* 外层主几何体 */}
      <group ref={outerRef}>
        {/* 半透明紫色晶格壳体 */}
        <mesh geometry={geometry}>
          <meshPhysicalMaterial
            color="#6b21a8"
            emissive="#3b0764"
            emissiveIntensity={0.2}
            roughness={0.08}
            transmission={0.85}
            thickness={0.5}
            ior={1.45}
            transparent
            opacity={0.42}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {/* 亮紫色/粉紫发光边框 */}
        <lineSegments geometry={wireGeometry}>
          <lineBasicMaterial color="#c084fc" toneMapped={false} transparent opacity={0.9} />
        </lineSegments>

        {/* 顶点发光光斑 (青蓝色量子节点) */}
        {vertices.map((pos, idx) => (
          <mesh key={idx} position={pos}>
            <sphereGeometry args={[0.048, 12, 12]} />
            <meshBasicMaterial color="#38bdf8" toneMapped={false} />
          </mesh>
        ))}
      </group>

      {/* 内层嵌套二十面体线框 */}
      <group ref={innerRef} scale={0.78}>
        <lineSegments geometry={wireGeometry}>
          <lineBasicMaterial color="#06b6d4" toneMapped={false} transparent opacity={0.65} />
        </lineSegments>
      </group>
    </>
  )
}

// -------------------------------------------------------------
// 3. 倾斜环形粒子轨道（Orbit Ring 粒子流）
// -------------------------------------------------------------
interface ParticleOrbitProps {
  radius: number
  rotation: [number, number, number]
  count?: number
  speed?: number
  tubeRadius?: number
}

function ParticleOrbit({
  radius,
  rotation,
  count = 320,
  speed = 0.5,
  tubeRadius = 0.08,
}: ParticleOrbitProps) {
  const pointsRef = useRef<THREE.Points>(null!)

  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)

    // 荧光紫、天蓝、亮白交替色系
    const palette = [
      new THREE.Color('#38bdf8'), // 天蓝
      new THREE.Color('#a855f7'), // 荧光紫
      new THREE.Color('#ffffff'), // 亮白
      new THREE.Color('#ec4899'), // 霓虹粉
    ]

    for (let i = 0; i < count; i++) {
      const theta = (i / count) * Math.PI * 2
      // 围绕环形轨迹做微小的高斯散布
      const spreadR = radius + (Math.random() - 0.5) * tubeRadius
      const spreadY = (Math.random() - 0.5) * tubeRadius

      pos[i * 3] = Math.cos(theta) * spreadR
      pos[i * 3 + 1] = spreadY
      pos[i * 3 + 2] = Math.sin(theta) * spreadR

      const chosenColor = palette[Math.floor(Math.random() * palette.length)]
      col[i * 3] = chosenColor.r
      col[i * 3 + 1] = chosenColor.g
      col[i * 3 + 2] = chosenColor.b
    }

    return { positions: pos, colors: col }
  }, [radius, count, tubeRadius])

  const particleGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  }, [positions, colors])

  useFrame((_, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * speed
    }
  })

  return (
    <group rotation={rotation}>
      {/* 粒子点云 */}
      <points ref={pointsRef} geometry={particleGeometry}>
        <pointsMaterial
          size={0.046}
          vertexColors
          transparent
          opacity={0.92}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </points>

      {/* 底层微光导轨圆环 */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius - 0.012, radius + 0.012, 128]} />
        <meshBasicMaterial
          color="#8b5cf6"
          transparent
          opacity={0.16}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}

// -------------------------------------------------------------
// 4. 球型薄雾 / 能量大气光晕（Fresnel + 呼吸噪波效果）
// -------------------------------------------------------------
function SphericalMist({ radius = 2.0 }: { radius?: number }) {
  const mistMatRef = useRef<THREE.ShaderMaterial>(null!)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColorCore: { value: new THREE.Color('#38bdf8') }, // 天蓝内敛光
      uColorRim: { value: new THREE.Color('#9333ea') },  // 紫色边缘光
    }),
    []
  )

  useFrame((state) => {
    if (mistMatRef.current) {
      mistMatRef.current.uniforms.uTime.value = state.clock.getElapsedTime()
    }
  })

  // 基于菲涅尔 (Fresnel) 视线夹角的平滑薄雾着色器：边缘柔和衰减，中心通透不遮挡内核
  const mistShader = useMemo(
    () => ({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldPosition;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          vec4 mvPosition = viewMatrix * worldPos;
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColorCore;
        uniform vec3 uColorRim;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldPosition;

        // 简易伪噪波用于薄雾流动飘逸感
        float hash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        void main() {
          vec3 viewDir = normalize(vViewPosition);
          vec3 normal = normalize(vNormal);

          // 计算边缘菲涅尔系数 (让球体边缘具有发光薄雾感)
          float fresnel = 1.0 - max(dot(viewDir, normal), 0.0);
          fresnel = pow(fresnel, 2.2);

          // 缓慢流动的雾气起伏
          float wave = sin(vWorldPosition.y * 3.0 + uTime * 0.8) * cos(vWorldPosition.x * 3.0 + uTime * 0.6) * 0.15;
          float pulse = 0.85 + 0.15 * sin(uTime * 1.5);

          // 双色渐变融合
          vec3 finalColor = mix(uColorCore, uColorRim, fresnel);

          // 透明度：中心稀薄（0.08~0.15），边缘泛光聚集（0.45~0.55），呈现球形星云薄雾
          float alpha = (fresnel * 0.45 + 0.08 + wave) * pulse;
          alpha = clamp(alpha, 0.0, 0.6);

          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
    }),
    []
  )

  return (
    <mesh>
      <sphereGeometry args={[radius, 64, 64]} />
      <shaderMaterial
        ref={mistMatRef}
        vertexShader={mistShader.vertexShader}
        fragmentShader={mistShader.fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// -------------------------------------------------------------
// 4. 整体场景集成（带 Float 呼吸浮动 + Post-processing Bloom）
// -------------------------------------------------------------
export function QuantumCoreScene() {
  return (
    <div className="relative w-full h-full min-h-[500px] bg-[#050510] overflow-hidden select-none">
      <Canvas
        camera={{ position: [0, 1.4, 4.8], fov: 45 }}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#050510']} />

        {/* 基础全向微弱环境光 */}
        <ambientLight intensity={0.4} />

        {/* 整体悬浮浮动 */}
        <Float speed={2.2} rotationIntensity={0.25} floatIntensity={0.35}>
          {/* 1. 核心高亮发光能量源 */}
          <EnergyCenter />

          {/* 2. 二十面体外壳及嵌套晶核 */}
          <PolyhedronShell />

          {/* 3. 球型动态能量薄雾（包裹在多面体周围，带菲涅尔边缘泛光与呼吸噪波） */}
          <SphericalMist radius={1.92} />

          {/* 4. 三组不同角度倾斜的轨道粒子环 */}
          <ParticleOrbit radius={2.25} rotation={[0.65, 0.45, 0.75]} speed={0.42} count={360} />
          <ParticleOrbit radius={2.45} rotation={[-0.85, -0.35, 0.25]} speed={-0.38} count={400} />
          <ParticleOrbit radius={2.65} rotation={[1.15, 0.85, -0.45]} speed={0.28} count={450} />

          {/* 4. 浮动星尘与点云 */}
          <Sparkles count={160} scale={6.0} size={3.0} speed={0.45} opacity={0.7} color="#38bdf8" />
          <Sparkles count={140} scale={5.0} size={3.2} speed={0.35} opacity={0.8} color="#c084fc" />
          <Sparkles count={80} scale={4.0} size={4.0} speed={0.6} opacity={0.9} color="#ffffff" />
        </Float>

        {/* 交互控制器 */}
        <OrbitControls enableDamping dampingFactor={0.05} maxDistance={9} minDistance={2.5} />

        {/* 5. 后处理特效：霓虹 Bloom 辉光 + 镜头色差 + 暗角 */}
        <EffectComposer>
          <Bloom mipmapBlur intensity={1.65} luminanceThreshold={0.22} luminanceSmoothing={0.3} />
          <ChromaticAberration
            offset={new THREE.Vector2(0.0015, 0.0015)}
            radialModulation={false}
            modulationOffset={0}
          />
          <Vignette eskil={false} offset={0.15} darkness={1.15} />
        </EffectComposer>
      </Canvas>

      {/* UI 提示小角标 */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-purple-300/60 font-mono tracking-wider backdrop-blur-sm bg-black/30 px-3 py-1.5 rounded-full border border-purple-500/20">
        DRAG TO ROTATE • SCROLL TO ZOOM
      </div>
    </div>
  )
}

export default QuantumCoreScene
