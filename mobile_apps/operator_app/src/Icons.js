import React from 'react';
import Svg, { Path, Circle, Rect, G, Polygon, Line } from 'react-native-svg';

// Unique, Professional Vector Icons for SDAS Mobile Apps
// Powered by react-native-svg for 100% vector fidelity across all Android & iOS devices

export function WaterDropIcon({ size = 24, color = '#38BDF8' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"
        fill={color}
        fillOpacity="0.25"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10 13a3 3 0 0 0 4 0"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function WeatherCloudSunIcon({ size = 24, color = '#F59E0B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Radiant Sun */}
      <Circle cx="12" cy="7" r="3.5" fill={color} />
      <Path
        d="M12 1.5v1.5M12 11v1.5M6.5 7H5M19 7h-1.5M8 3.5l1 1M16 3.5l-1 1"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Cloud in front */}
      <Path
        d="M7 19h10a4 4 0 0 0 .5-7.97 5 5 0 0 0-9.6 1.1A3.5 3.5 0 0 0 7 19z"
        fill="#94A3B8"
        fillOpacity="0.3"
        stroke="#CBD5E1"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ReportFloodIcon({ size = 24, color = '#EF4444' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polygon
        points="12,2 22,20 2,20"
        fill={color}
        fillOpacity="0.2"
        stroke={color}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <Path
        d="M12 8v5M12 16v1"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <Path
        d="M7 18q2.5-2 5 0t5 0"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function CommunityIcon({ size = 24, color = '#3B82F6' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="7" r="3.2" stroke={color} strokeWidth="1.8" fill={color} fillOpacity="0.2" />
      <Path
        d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <Circle cx="16.5" cy="8.5" r="2.5" stroke={color} strokeWidth="1.6" />
      <Path
        d="M16 13.5c2.4.4 4 2.2 4 4.5"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function MapPinIcon({ size = 24, color = '#EF4444' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21s7-6.2 7-11.2a7 7 0 1 0-14 0C5 14.8 12 21 12 21z"
        fill={color}
        fillOpacity="0.2"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="9.8" r="2.8" fill={color} />
    </Svg>
  );
}

export function CameraIcon({ size = 24, color = '#2563EB' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"
        fill={color}
        fillOpacity="0.15"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="13" r="3.5" stroke={color} strokeWidth="2" />
    </Svg>
  );
}

export function HomeIcon({ size = 24, color = '#64748B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 10.5l9-7.5 9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.5 21v-7h5v7"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ClipboardReportIcon({ size = 24, color = '#64748B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="4" width="16" height="17" rx="2" stroke={color} strokeWidth="2" />
      <Path d="M9 2h6v3H9z" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <Path d="M8 10h8M8 14h5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M15 15l2 2 3-3" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function BellAlertIcon({ size = 24, color = '#EF4444' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
        fill={color}
        fillOpacity="0.15"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function ChatBubbleIcon({ size = 24, color = '#3B82F6' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SluiceGateIcon({ size = 24, color = '#F59E0B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="2" y="4" width="4" height="16" rx="1" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1.8" />
      <Rect x="18" y="4" width="4" height="16" rx="1" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1.8" />
      <Rect x="4" y="3" width="16" height="3" rx="0.5" stroke={color} strokeWidth="1.6" />
      <Rect x="6" y="8" width="12" height="7" rx="1" fill={color} stroke={color} strokeWidth="1.8" />
      <Path d="M6 18c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0" stroke="#38BDF8" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function DashboardGaugeIcon({ size = 24, color = '#38BDF8' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4.93 19.07A10 10 0 1 1 19.07 19.07"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <Path d="M12 12l3.5-3.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <Circle cx="12" cy="12" r="2.2" fill={color} />
    </Svg>
  );
}

export function GearSettingsIcon({ size = 24, color = '#94A3B8' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3.2" stroke={color} strokeWidth="2" />
      <Path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke={color}
        strokeWidth="1.8"
      />
    </Svg>
  );
}

export function CheckShieldIcon({ size = 24, color = '#10B981' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        fill={color}
        fillOpacity="0.2"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <Path d="M9 12l2 2 4-4" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function HamburgerIcon({ size = 24, color = '#1E293B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 6h16M4 12h16M4 18h16" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </Svg>
  );
}

export function ArrowLeftIcon({ size = 24, color = '#1E293B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M12 19l-7-7 7-7" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function MoreHorizontalIcon({ size = 24, color = '#64748B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="1.8" fill={color} />
      <Circle cx="19" cy="12" r="1.8" fill={color} />
      <Circle cx="5" cy="12" r="1.8" fill={color} />
    </Svg>
  );
}

export function WindIcon({ size = 24, color = '#0284C7' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function DropletIcon({ size = 24, color = '#0284C7' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CloudRainIcon({ size = 24, color = '#0284C7' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M16 13v6M8 13v6M12 15v6M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SunriseIcon({ size = 24, color = '#F59E0B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2v6M4.93 10.93l1.41 1.41M2 18h2M20 18h2M19.07 10.93l-1.41 1.41M22 22H2M8 6l4-4 4 4M16 18a4 4 0 0 0-8 0" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SunsetIcon({ size = 24, color = '#F97316' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 10V4M4.93 10.93l1.41 1.41M2 18h2M20 18h2M19.07 10.93l-1.41 1.41M22 22H2M16 6l-4 4-4-4M16 18a4 4 0 0 0-8 0" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SendIcon({ size = 24, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function UserIcon({ size = 24, color = '#64748B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="7" r="4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function LockIcon({ size = 24, color = '#64748B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="11" width="18" height="11" rx="2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function EyeIcon({ size = 24, color = '#64748B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function EyeOffIcon({ size = 24, color = '#64748B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PhoneCallIcon({ size = 24, color = '#10B981' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function TrashIcon({ size = 24, color = '#EF4444' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ShieldIcon({ size = 24, color = '#3B82F6' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function FlameIcon({ size = 24, color = '#EF4444' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 17c1.38 0 2.5-1.12 2.5-2.5 0-1.63-1.04-2.8-1.5-3.5-.46.7-1.5 1.87-1.5 3.5zM12 2c0 3-3 5-3 8a4 4 0 0 0 8 0c0-3-3-5-3-8z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CheckIcon({ size = 24, color = '#10B981' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function AlertTriangleIcon({ size = 24, color = '#EF4444' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="12" y1="9" x2="12" y2="13" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Circle cx="12" cy="17" r="1" fill={color} />
    </Svg>
  );
}

export function InfoCircleIcon({ size = 24, color = '#0284C7' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="12" y1="16" x2="12" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Circle cx="12" cy="8" r="1" fill={color} />
    </Svg>
  );
}

export function SlidersIcon({ size = 24, color = '#64748B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="4" y1="21" x2="4" y2="14" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="4" y1="10" x2="4" y2="3" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="12" y1="21" x2="12" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="12" y1="8" x2="12" y2="3" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="20" y1="21" x2="20" y2="16" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="20" y1="12" x2="20" y2="3" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="1" y1="14" x2="7" y2="14" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="9" y1="8" x2="15" y2="8" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="17" y1="16" x2="23" y2="16" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function ThermometerIcon({ size = 24, color = '#EF4444' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="11.5" cy="17.5" r="2" fill={color} />
      <Line x1="11.5" y1="8" x2="11.5" y2="15.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function SensorIcon({ size = 24, color = '#10B981' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="4" width="16" height="16" rx="2" stroke={color} strokeWidth="2" />
      <Rect x="9" y="9" width="6" height="6" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1.5" />
      <Path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}
