import React, { useRef, useState, useEffect, useMemo } from 'react';
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
// Anatomical Scene Component: Renders BodyParts3D Myocardium & Segmented Vessels
// ---------------------------------------------------------------------------
interface AnatomicalHeartGroupProps {
  heartGeo: THREE.BufferGeometry;
  ladGeo: THREE.BufferGeometry;
  lcxGeo: THREE.BufferGeometry;
  rcaGeo: THREE.BufferGeometry;
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

const AnatomicalHeartGroup: React.FC<AnatomicalHeartGroupProps> = ({
  heartGeo,
  ladGeo,
  lcxGeo,
  rcaGeo,
  vesselColormap,
  selectedVessel,
  onSelectVessel,
  predictionsAvailable,
  isPulsing
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hoveredVessel, setHoveredVessel] = useState<string | null>(null);

  // Soft physiological ventricular contraction cycle
  useFrame((state) => {
    if (groupRef.current) {
      if (isPulsing) {
        const t = state.clock.getElapsedTime();
        // Two-stage cardiac ventricular ejection pulse
        const beat = 1.0 + 0.02 * Math.sin(t * 4.2) + 0.01 * Math.sin(t * 8.4);
        groupRef.current.scale.set(beat, beat, beat);
      } else {
        groupRef.current.scale.set(1, 1, 1);
      }
    }
  });

  // Color resolver for each coronary branch
  const getVesselColor = (key: 'LAD' | 'LCX' | 'RCA') => {
    if (predictionsAvailable && vesselColormap && vesselColormap[key]) {
      return vesselColormap[key].color_hex;
    }
    // Baseline clinical distinction prior to running prediction
    if (key === 'LAD') return '#38bdf8'; // Cyan
    if (key === 'LCX') return '#818cf8'; // Indigo
    return '#fb923c';                    // Coral
  };

  const renderCoronaryMesh = (
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
          emissiveIntensity={isSelected ? 0.8 : isHovered ? 0.5 : 0.05}
          roughness={0.25}
          metalness={0.3}
          polygonOffset
          polygonOffsetFactor={-1} // Render vessel cleanly on top of myocardium
          polygonOffsetUnits={-1}
        />
      </mesh>
    );
  };

  return (
    <group ref={groupRef} position={[0, -0.1, 0]}>
      {/* 1. BodyParts3D Myocardium (Cardiac Muscle Walls & Chambers - FMA7088) */}
      <mesh geometry={heartGeo}>
        <meshStandardMaterial
          color="#661028" // Deep anatomical myocardial burgundy
          roughness={0.65}
          metalness={0.15}
        />
      </mesh>

      {/* 2. BodyParts3D LAD Coronary Tree (FMA3862 / FMA74912) */}
      {renderCoronaryMesh('LAD', ladGeo)}

      {/* 3. BodyParts3D LCX Coronary Tree (FMA3895) */}
      {renderCoronaryMesh('LCX', lcxGeo)}

      {/* 4. BodyParts3D RCA Coronary Tree (FMA50039 / FMA3802) */}
      {renderCoronaryMesh('RCA', rcaGeo)}
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

  // Model geometries loaded from BodyParts3D assets
  const [geometries, setGeometries] = useState<{
    heart: THREE.BufferGeometry | null;
    lad: THREE.BufferGeometry | null;
    lcx: THREE.BufferGeometry | null;
    rca: THREE.BufferGeometry | null;
  }>({
    heart: null,
    lad: null,
    lcx: null,
    rca: null
  });
  const [isLoadingModel, setIsLoadingModel] = useState<boolean>(true);
  const [modelError, setModelError] = useState<string | null>(null);

  // Load BodyParts3D BufferGeometry assets on mount
  useEffect(() => {
    let isMounted = true;
    const loader = new THREE.BufferGeometryLoader();

    async function loadModels() {
      try {
        setIsLoadingModel(true);
        setModelError(null);

        const [heartRes, ladRes, lcxRes, rcaRes] = await Promise.all([
          fetch('/models/heart_myocardium.json').then((r) => r.json()),
          fetch('/models/lad.json').then((r) => r.json()),
          fetch('/models/lcx.json').then((r) => r.json()),
          fetch('/models/rca.json').then((r) => r.json())
        ]);

        if (!isMounted) return;

        setGeometries({
          heart: loader.parse(heartRes),
          lad: loader.parse(ladRes),
          lcx: loader.parse(lcxRes),
          rca: loader.parse(rcaRes)
        });
      } catch (err: any) {
        console.error('Failed to load BodyParts3D models:', err);
        if (isMounted) {
          setModelError('Unable to load BodyParts3D anatomical meshes.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingModel(false);
        }
      }
    }

    loadModels();
    return () => {
      isMounted = false;
    };
  }, []);

  const resetView = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  const vesselDetails = useMemo(() => {
    if (!selectedVessel || !vesselColormap) return null;
    const v = vesselColormap[selectedVessel as 'LAD' | 'LCX' | 'RCA'];
    if (!v) return null;

    const descriptions: Record<string, { fma: string; territory: string; model: string; cvAuc: string }> = {
      LAD: {
        fma: 'FMA3862 / FMA74912',
        territory: 'Anterior wall of left ventricle, anterior interventricular septum, apex & diagonal branches.',
        model: 'GradientBoostingClassifier',
        cvAuc: '0.8365'
      },
      LCX: {
        fma: 'FMA3895',
        territory: 'Lateral & posterior-lateral left ventricular myocardium via obtuse marginal branches.',
        model: 'RandomForestClassifier',
        cvAuc: '0.7132'
      },
      RCA: {
        fma: 'FMA50039 / FMA3802',
        territory: 'Right ventricle, inferior wall, sinoatrial/AV node & posterior descending artery (PDA).',
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

  const hasAllGeometries =
    geometries.heart && geometries.lad && geometries.lcx && geometries.rca;

  return (
    <div className="heart-viewer-wrapper">
      {/* 3D Canvas */}
      <div className="canvas-container">
        {isLoadingModel && (
          <div className="model-loading-overlay">
            <span className="spinner" />
            <span>Loading BodyParts3D Anatomical Meshes...</span>
          </div>
        )}

        {modelError && (
          <div className="model-error-overlay">
            <span>{modelError}</span>
          </div>
        )}

        <Canvas
          camera={{ position: [0, 0.2, 3.8], fov: 45 }}
          gl={{ antialias: true, alpha: true }}
        >
          {/* Medical Imaging Lighting Setup */}
          <ambientLight intensity={0.8} />
          <directionalLight position={[4, 5, 4]} intensity={1.5} color="#ffffff" />
          <directionalLight position={[-4, 3, -3]} intensity={0.7} color="#38bdf8" />
          <directionalLight position={[0, -4, 2]} intensity={0.5} color="#ffffff" />
          <pointLight position={[0, 2, 3]} intensity={0.8} color="#f8fafc" />

          {hasAllGeometries && (
            <AnatomicalHeartGroup
              heartGeo={geometries.heart!}
              ladGeo={geometries.lad!}
              lcxGeo={geometries.lcx!}
              rcaGeo={geometries.rca!}
              vesselColormap={vesselColormap}
              selectedVessel={selectedVessel}
              onSelectVessel={onSelectVessel}
              predictionsAvailable={predictionsAvailable}
              isPulsing={isPulsing}
            />
          )}

          <OrbitControls
            ref={controlsRef}
            enableDamping
            dampingFactor={0.06}
            minDistance={2.0}
            maxDistance={7.0}
            rotateSpeed={0.85}
          />
        </Canvas>
      </div>

      {/* Top Overlay Controls Bar */}
      <div className="viewer-controls-bar">
        <div className="viewer-title-group">
          <div className="viewer-badge-row">
            <span className="viewer-badge">BODYPARTS3D ANATOMICAL RESOURCE</span>
            <span className="cc-license-tag">CC BY-SA 2.1 JP</span>
          </div>
          <span className="viewer-subtext">
            Authentic human cardiac geometry &bull; Click any coronary vessel to inspect
          </span>
        </div>
        <div className="viewer-actions">
          <button
            type="button"
            className={`viewer-btn ${isPulsing ? 'active' : ''}`}
            onClick={() => setIsPulsing(!isPulsing)}
            title="Toggle Cardiac Contraction Motion"
          >
            <Activity size={15} />
            <span>{isPulsing ? 'Pulse On' : 'Paused'}</span>
          </button>
          <button
            type="button"
            className="viewer-btn"
            onClick={resetView}
            title="Reset Camera View to Standard Coronal Projection"
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

      {/* Selected Vessel Detail Inspector Card */}
      {vesselDetails && (
        <div className="vessel-inspector-card">
          <div className="inspector-header">
            <div>
              <span className="inspector-tag">{vesselDetails.key} BRANCH &bull; {vesselDetails.fma}</span>
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

            {/* Probability Progress Fill */}
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
              <div>
                <span className="meta-k">Anatomical Source:</span>
                <span className="meta-v">BodyParts3D (DBCLS)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Color Scale Legend & Statutory Anatomical Honesty Note */}
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
          <span>
            BodyParts3D anatomical reference mesh (© DBCLS CC BY-SA 2.1 Japan). Segmented LAD, LCX & RCA vessels. Vessel colors reflect model-predicted stenosis likelihoods (≥50% narrowing), not observed patient plaque coordinates.
          </span>
        </div>
      </div>
    </div>
  );
};
