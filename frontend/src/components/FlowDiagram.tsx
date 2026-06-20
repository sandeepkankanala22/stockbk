import { Box, Paper, Typography } from '@mui/material';
import type { DashboardTreeNode, TimingStats } from '../types';
import { formatPercent } from '../utils/formatters';

interface FlowDiagramProps {
  tree: DashboardTreeNode;
}

const COLORS: Record<string, string> = {
  root: '#1a237e',
  first_target: '#2e7d32',
  first_stoploss: '#c62828',
  target_then_sl: '#ef6c00',
  target_never_sl: '#81c784',
  sl_then_target: '#1565c0',
  sl_never_target: '#e57373',
  sideways: '#ed6c02',
  no_breakout: '#757575',
  never_stoploss: '#6a1b9a',
  errors: '#b71c1c',
};

function fmtTiming(label: string, t: TimingStats): string | null {
  if (t.count === 0 || t.minDays == null) return null;
  return `${label}: ${t.minDays} / ${t.avgDays} / ${t.maxDays} d (${t.minMonths}–${t.maxMonths} mo)`;
}

function StageBox({ node, compact }: { node: DashboardTreeNode; compact?: boolean }) {
  const color = COLORS[node.id] ?? '#455a64';
  const timingLines = [
    fmtTiming('→ 1st target', node.toFirstTarget),
    fmtTiming('→ 1st stoploss', node.toFirstStoploss),
    node.afterPriorHit ? fmtTiming('→ after prior', node.afterPriorHit) : null,
  ].filter(Boolean) as string[];

  return (
    <Paper
      elevation={2}
      sx={{
        width: compact ? 200 : 220,
        minHeight: compact ? 120 : 130,
        p: 1.5,
        borderTop: `4px solid ${color}`,
        bgcolor: 'background.paper',
        textAlign: 'center',
      }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2, mb: 0.75 }}>
        {node.label}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 700, color, lineHeight: 1 }}>
        {node.count}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block">
        {formatPercent(node.pct)} of all
      </Typography>
      {node.pctOfParent != null && (
        <Typography variant="caption" color="text.secondary" display="block">
          {formatPercent(node.pctOfParent)} of branch
        </Typography>
      )}
      {timingLines.length > 0 && (
        <Box sx={{ mt: 1, pt: 1, borderTop: '1px dashed', borderColor: 'divider' }}>
          {timingLines.map((line) => (
            <Typography
              key={line}
              variant="caption"
              display="block"
              sx={{ fontSize: '0.65rem', lineHeight: 1.4, color: 'text.secondary' }}
            >
              {line}
            </Typography>
          ))}
        </Box>
      )}
    </Paper>
  );
}

function BranchColumn({ parent, children }: { parent: DashboardTreeNode; children: DashboardTreeNode[] }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
      <StageBox node={parent} />
      <Box sx={{ width: 2, height: 20, bgcolor: 'grey.400' }} />
      <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
        {children.map((child) => (
          <Box key={child.id} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box sx={{ width: 2, height: 16, bgcolor: 'grey.400' }} />
            <StageBox node={child} compact />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function LeafColumn({ node }: { node: DashboardTreeNode }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Box sx={{ width: 2, height: 20, bgcolor: 'grey.400' }} />
      <StageBox node={node} compact />
    </Box>
  );
}

export default function FlowDiagram({ tree }: FlowDiagramProps) {
  const children = tree.children ?? [];
  const firstTarget = children.find((c) => c.id === 'first_target');
  const firstSl = children.find((c) => c.id === 'first_stoploss');
  const leaves = children.filter(
    (c) => c.id !== 'first_target' && c.id !== 'first_stoploss'
  );

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        overflow: 'auto',
        bgcolor: '#f8f9fc',
        borderRadius: 2,
      }}
    >
      {/* Level 0 — root */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
        <StageBox node={tree} />
        <Box sx={{ width: 2, height: 28, bgcolor: 'grey.500' }} />
        <Box sx={{ width: '90%', maxWidth: 1100, height: 2, bgcolor: 'grey.400' }} />
      </Box>

      {/* Level 1 + 2 — branches */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 3,
          alignItems: 'flex-start',
        }}
      >
        {firstTarget && firstTarget.children && (
          <BranchColumn parent={firstTarget} children={firstTarget.children} />
        )}
        {firstSl && firstSl.children && (
          <BranchColumn parent={firstSl} children={firstSl.children} />
        )}
        {leaves.map((leaf) => (
          <LeafColumn key={leaf.id} node={leaf} />
        ))}
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>
        Timing lines show min / avg / max days from buy (→ after prior = days from first hit to follow-up event)
      </Typography>
    </Paper>
  );
}
