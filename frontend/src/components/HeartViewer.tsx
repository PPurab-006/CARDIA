import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Activity, RotateCcw, Info } from 'lucide-react';
import type { VesselVisualization } from '../types/api';

interface HeartViewerProps {
  vesselColormap?: {
    LAD: VesselVisualization;
    LCX: VesselVisualization;
    RCA: VesselVisualization;
  };
  selectedVessel: string | null;
  onSelectVessel: (vesselKey: string | null) => void;
  predictionsAvailable: boolean;
}

// ---------------------------------------------------------------------------
// Procedural Anatomical Coronary Curves
// ---------------------------------------------------------------------------
const LAD_POINTS = [
  new THREE.Vector3(0.18, 0.72, 0.75),   // Left main bifurcation
  new THREE.Vector3(0.24, 0.45, 0.90),
  new THREE.Vector3(0.20, 0.15, 0.98),
  new THREE.Vector3(0.12, -0.22, 0.92),  // Mid-LAD in anterior sulcus
  new THREE.Vector3(0.04, -0.58, 0.78),
  new THREE.Vector3(-0.02, -0.88, 0.58), // Distal LAD
  new THREE.Vector3(-0.06, -1.08, 0.38), // Apex
];

const LCX_POINTS = [
  new THREE.Vector3(0.18, 0.72, 0.75),   // Left main bifurcation
  new THREE.Vector3(0.48, 0.65, 0.65),
  new THREE.Vector3(0.82, 0.52, 0.35),   // Circumflex curving posterolaterally
  new THREE.Vector3(0.96, 0.30, -0.05),
  new THREE.Vector3(0.88, 0.05, -0.38),  // Obtuse marginal territory
  new THREE.Vector3(0.70, -0.25, -0.55),
  new THREE.Vector3(0.48, -0.50, -0.58), // Posterior lateral branch
];

const RCA_POINTS = [
  new THREE.Vector3(-0.25, 0.70, 0.72),  // Right coronary sinus origin
  new THREE.Vector3(-0.55, 0.55, 0.68),
  new THREE.Vector3(-0.78, 0.32, 0.52),  // Right AV groove
  new THREE.Vector3(-0.85, 0.02, 0.30),
  new THREE.Vector3(-0.80, -0.35, 0.08), // Acute margin
  new THREE.Vector3(-0.62, -0.62, -0.22),
  new THREE.Vector3(-0.35, -0.80, -0.45),// Posterior descending artery (PDA)
];

// Helper to create smooth tube geometries
function createTube(points: THREE.Vector3[], radius: number = 0.045) {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.TubeGeometry(curve, 64, radius, 12, false);
}

// ---------------------------------------------------------------------------
// 3D Heart Mesh & Coronary Vessels Scene
// ---------------------------------------------------------------------------
interface HeartMeshProps {
  vesselColormap?: {
    LAD: VesselVisualization;
    LCX: VesselVisualization;
    RCA: VesselVisualization;
  };
  selectedVessel: string | null;
  onSelectVessel: (vesselKey: string | null) => void;
  predictionsAvailable: boolean;
  isPulsing: boolean;
}

const HeartGroup: React.FC<HeartMeshProps> = ({
  vesselColormap,
  selectedVessel,
  onSelectVessel,
  predictionsAvailable,
  isPulsing
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hoveredVessel, setHoveredVessel] = useState<string | null>(null);

  // Precompute geometries
  const ladGeo = useMemo(() => createTube(LAD_POINTS, 0.048), []);
  const lcxGeo = useMemo(() => createTube(LCX_POINTS, 0.044), []);
  const rcaGeo = useMemo(() => createTube(RCA_POINTS, 0.046), []);

  // Soft cardiac beat animation
  useFrame((state) => {
    if (groupRef.current) {
      if (isPulsing) {
        const t = state.clock.getElapsedTime();
        // Physiological two-stage ventricular contraction pulse
        const beat = 1.0 + 0.022 * Math.sin(t * 4.2) + 0.012 * Math.sin(t * 8.4);
        groupRef.current.scale.set(beat, beat, beat);
      } else {
        groupRef.current.scale.set(1, 1, 1);
      }
    }
  });

  // Color resolver
  const getVesselColor = (key: 'LAD' | 'LCX' | 'RCA') => {
    if (predictionsAvailable && vesselColormap && vesselColormap[key]) {
      return vesselColormap[key].color_hex;
    }
    // Neutral anatomical slate/amber baseline before prediction
    if (key === 'LAD') return '#38bdf8'; // Sky blue
    if (key === 'LCX') return '#818cf8'; // Indigo
    return '#fb923c';                    // Coral
  };

  const renderCoronaryArtery = (
    key: 'LAD' | 'LCX' | 'RCA',
    geo: THREE.BufferGeometry
  ) => {
    const isSelected = selectedVessel === key;
    const isHovered = hoveredVessel === key;
    const baseColor = getVesselColor(key);

    return (
      <mesh
        geometry={geo}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredVessel(key);
        }}
        onPointerOut={() => setHoveredVessel(null)}
        onClick={(e) => {
          e.stopPropagation();
          onSelectVessel(isSelected ? null : key);
        }}
      >
        <meshStandardMaterial
          color={baseColor}
          emissive={isSelected ? baseColor : isHovered ? '#38bdf8' : '#000000'}
          emissiveIntensity={isSelected ? 0.75 : isHovered ? 0.45 : 0.0}
          roughness={0.25}
          metalness={0.35}
        />
      </mesh>
    );
  };

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* 1. Main Cardiac Myocardium (Ventricles & Conical Apex) */}
      <mesh position={[0, -0.15, 0]} rotation={[0.08, 0.1, -0.12]}>
        <sphereGeometry args={[1.12, 48, 48]} />
        <meshStandardMaterial
          color="#881337" // Deep anatomical myocardial burgundy
          roughness={0.65}
          metalness={0.12}
        />
      </mesh>

      {/* 2. Left Ventricular Posterior Bulk */}
      <mesh position={[0.22, -0.28, -0.18]} rotation={[0.1, 0.2, -0.15]}>
        <sphereGeometry args={[0.95, 36, 36]} />
        <meshStandardMaterial
          color="#7f1d1d"
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>

      {/* 3. Atria & Base of Heart */}
      <mesh position={[-0.28, 0.65, -0.1]} rotation={[-0.1, 0, 0.15]}>
        <sphereGeometry args={[0.62, 32, 32]} />
        <meshStandardMaterial
          color="#991b1b"
          roughness={0.6}
          metalness={0.15}
        />
      </mesh>
      <mesh position={[0.35, 0.62, -0.15]} rotation={[-0.1, 0, -0.15]}>
        <sphereGeometry args={[0.58, 32, 32]} />
        <meshStandardMaterial
          color="#991b1b"
          roughness={0.6}
          metalness={0.15}
        />
      </mesh>

      {/* 4. Aortic Root & Arch (Ascending Aorta) */}
      <mesh position={[0.05, 1.05, 0.12]} rotation={[-0.15, 0.1, 0.05]}>
        <cylinderGeometry args={[0.26, 0.32, 0.85, 28]} />
        <meshStandardMaterial
          color="#b91c1c"
          roughness={0.4}
          metalness={0.25}
        />
      </mesh>

      {/* 5. Pulmonary Trunk & Artery */}
      <mesh position={[-0.18, 0.95, 0.32]} rotation={[0.25, -0.2, 0.1]}>
        <cylinderGeometry args={[0.22, 0.26, 0.72, 28]} />
        <meshStandardMaterial
          color="#1e3a8a" // Deoxygenated pulmonary blue tone
          roughness={0.45}
          metalness={0.2}
        />
      </mesh>

      {/* 6. Aortic Main Bifurcation Hub */}
      <mesh position={[0.05, 0.78, 0.58]}>
        <sphereGeometry args={[0.16, 20, 20]} />
        <meshStandardMaterial color="#dc2626" roughness={0.3} metalness={0.3} />
      </mesh>

      {/* 7. The Three Coronary Arteries */}
      {renderCoronaryArtery('LAD', ladGeo)}
      {renderCoronaryArtery('LCX', lcxGeo)}
      {renderCoronaryArtery('RCA', rcaGeo)}
    </group>
  );
};

// ---------------------------------------------------------------------------
// Main HeartViewer Container
// ---------------------------------------------------------------------------
export const HeartViewer: React.FC<HeartViewerProps> = ({
  vesselColormap,
  selectedVessel,
  onSelectVessel,
  predictionsAvailable
}) => {
  const controlsRef = useRef<any>(null);
  const [isPulsing, setIsPulsing] = useState<boolean>(true);

  const resetView = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  const vesselDetails = useMemo(() => {
    if (!selectedVessel || !vesselColormap) return null;
    const v = vesselColormap[selectedVessel as 'LAD' | 'LCX' | 'RCA'];
    if (!v) return null;

    const descriptions: Record<string, { territory: string; model: string; cvAuc: string }> = {
      LAD: {
        territory: 'Anterior wall of left ventricle, interventricular septum & apex.',
        model: 'GradientBoostingClassifier',
        cvAuc: '0.8365'
      },
      LCX: {
        territory: 'Lateral & posterior-lateral left ventricular myocardium.',
        model: 'RandomForestClassifier',
        cvAuc: '0.7132'
      },
      RCA: {
        territory: 'Right ventricle, inferior posterior wall & sinoatrial/AV node.',
        model: 'LogisticRegression',
        cvAuc: '0.7094'
      }
    };

    return {
      key: selectedVessel,
      name: v.name,
      probability: v.probability,
      riskLevel: v.risk_level,
      colorHex: v.color_hex,
      ...descriptions[selectedVessel]
    };
  }, [selectedVessel, vesselColormap]);

  return (
    <div className="heart-viewer-wrapper">
      {/* 3D Canvas */}
      <div className="canvas-container">
        <Canvas
          camera={{ position: [0, 0.4, 4.2], fov: 45 }}
          gl={{ antialias: true, alpha: true }}
        >
          {/* Medical Imaging Lighting Setup */}
          <ambientLight intensity={0.75} />
          <directionalLight position={[4, 5, 4]} intensity={1.4} color="#ffffff" />
          <directionalLight position={[-4, 3, -3]} intensity={0.6} color="#38bdf8" />
          <directionalLight position={[0, -4, 2]} intensity={0.4} color="#ffffff" />
          <pointLight position={[0, 2, 3]} intensity={0.8} color="#f8fafc" />

          <HeartGroup
            vesselColormap={vesselColormap}
            selectedVessel={selectedVessel}
            onSelectVessel={onSelectVessel}
            predictionsAvailable={predictionsAvailable}
            isPulsing={isPulsing}
          />

          <OrbitControls
            ref={controlsRef}
            enableDamping
            dampingFactor={0.06}
            minDistance={2.2}
            maxDistance={7.5}
            rotateSpeed={0.85}
          />
        </Canvas>
      </div>

      {/* Top Overlay Controls Bar */}
      <div className="viewer-controls-bar">
        <div className="viewer-title-group">
          <span className="viewer-badge">3D ANATOMICAL REFERENCE</span>
          <span className="viewer-subtext">Click any coronary vessel to inspect predicted stenosis risk</span>
        </div>
        <div className="viewer-actions">
          <button
            type="button"
            className={`viewer-btn ${isPulsing ? 'active' : ''}`}
            onClick={() => setIsPulsing(!isPulsing)}
            title="Toggle Cardiac Motion"
          >
            <Activity size={15} />
            <span>{isPulsing ? 'Pulse On' : 'Paused'}</span>
          </button>
          <button
            type="button"
            className="viewer-btn"
            onClick={resetView}
            title="Reset Camera View"
          >
            <RotateCcw size={15} />
            <span>Reset View</span>
          </button>
        </div>
      </div>

      {/* Vessel Quick Select Buttons */}
      <div className="vessel-selector-dock">
        {(['LAD', 'LCX', 'RCA'] as const).map((key) => {
          const vData = vesselColormap?.[key];
          const isSelected = selectedVessel === key;
          const probStr = vData ? `${(vData.probability * 100).toFixed(0)}%` : '--';
          const color = vData?.color_hex || '#64748b';

          return (
            <button
              key={key}
              type="button"
              className={`vessel-dock-pill ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectVessel(isSelected ? null : key)}
            >
              <span className="vessel-dot" style={{ backgroundColor: color }} />
              <span className="vessel-code">{key}</span>
              <span className="vessel-prob">{probStr}</span>
            </button>
          );
        })}
      </div>

      {/* Selected Vessel Inspector Card */}
      {vesselDetails && (
        <div className="vessel-inspector-card">
          <div className="inspector-header">
            <div>
              <span className="inspector-tag">{vesselDetails.key} BRANCH</span>
              <h4 className="inspector-title">{vesselDetails.name}</h4>
            </div>
            <button
              type="button"
              className="inspector-close-btn"
              onClick={() => onSelectVessel(null)}
            >
              ✕
            </button>
          </div>

          <div className="inspector-body">
            <div className="inspector-metric-row">
              <span className="metric-label">Predicted Stenosis Likelihood</span>
              <span className="metric-val" style={{ color: vesselDetails.colorHex }}>
                {(vesselDetails.probability * 100).toFixed(1)}% ({vesselDetails.riskLevel})
              </span>
            </div>

            {/* Probability Bar */}
            <div className="inspector-meter">
              <div
                className="inspector-meter-fill"
                style={{
                  width: `${Math.min(100, vesselDetails.probability * 100)}%`,
                  backgroundColor: vesselDetails.colorHex
                }}
              />
            </div>

            <p className="inspector-territory">{vesselDetails.territory}</p>

            <div className="inspector-meta-grid">
              <div>
                <span className="meta-k">Model Architecture:</span>
                <span className="meta-v">{vesselDetails.model}</span>
              </div>
              <div>
                <span className="meta-k">CV ROC-AUC:</span>
                <span className="meta-v">{vesselDetails.cvAuc}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Color Scale Legend & Honesty Notice */}
      <div className="viewer-bottom-bar">
        <div className="color-scale-legend">
          <span className="legend-title">Stenosis Likelihood Scale:</span>
          <div className="scale-item">
            <span className="scale-swatch" style={{ backgroundColor: '#10b981' }} />
            <span>&lt;30% (Low)</span>
          </div>
          <div className="scale-item">
            <span className="scale-swatch" style={{ backgroundColor: '#f59e0b' }} />
            <span>30–60% (Moderate)</span>
          </div>
          <div className="scale-item">
            <span className="scale-swatch" style={{ backgroundColor: '#ef4444' }} />
            <span>&gt;60% (High)</span>
          </div>
        </div>

        <div className="anatomical-honesty-note">
          <Info size={13} className="info-icon" />
          <span>Reference anatomical geometry. Vessel colors display model-predicted probabilities (&ge;50% stenosis), not physical plaque geometry.</span>
        </div>
      </div>
    </div>
  );
};
