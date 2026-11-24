import { useLayoutEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'

export interface Placement {
  p: [number, number, number]
  s?: [number, number, number]
  r?: number
  c?: string
}

/** Renders many copies of one mesh in a single draw call. */
export function Instances({
  items,
  children,
  castShadow,
  receiveShadow,
}: {
  items: Placement[]
  children: ReactNode
  castShadow?: boolean
  receiveShadow?: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const o = new THREE.Object3D()
    const color = new THREE.Color()
    items.forEach((it, i) => {
      o.position.set(...it.p)
      o.rotation.set(0, it.r ?? 0, 0)
      o.scale.set(...(it.s ?? [1, 1, 1]))
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
      if (it.c) mesh.setColorAt(i, color.set(it.c))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow={castShadow} receiveShadow={receiveShadow}>
      {children}
    </instancedMesh>
  )
}
