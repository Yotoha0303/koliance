'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

// 客户端动态加载，禁用 SSR 避免 WebGL 初始化报错
const QuantumCoreScene = dynamic(
  () => import('@/components/quantum-core/QuantumCoreScene'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#050510] text-purple-400 font-mono text-sm animate-pulse">
        Initializing Quantum Core...
      </div>
    ),
  }
)

export default function QuantumCorePage() {
  return (
    <main className="relative w-screen h-screen bg-[#050510] overflow-hidden">
      {/* 顶部标题栏 */}
      <div className="absolute top-6 left-6 z-10 flex items-center gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition backdrop-blur-md text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <div>
          <h1 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
            QUANTUM ENERGY CORE
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block" />
          </h1>
          <p className="text-xs text-purple-300/70 font-mono">
            R3F • DREI • POSTPROCESSING
          </p>
        </div>
      </div>

      {/* 3D 场景 */}
      <QuantumCoreScene />
    </main>
  )
}
