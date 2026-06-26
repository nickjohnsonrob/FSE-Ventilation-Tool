import type { Meta, StoryObj } from '@storybook/react';
import { ResultsBand } from './ResultsBand';

const meta = {
  title: 'Components/ResultsBand',
  component: ResultsBand,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ResultsBand>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleMultiResult = {
  rows: [],
  sumPzRp: 100,
  sumAzRa: 120,
  sumPz: 20,
  sumVpz: 1200,
  sumArea: 2000,
  ps: 20,
  D: 1.0,
  vou: 220,
  vps: 1200,
  xs: 220 / 1200,
  crit: null,
  evA: 1.0,
  maxZ: null,
  maxZp: 0,
  evS: 0.9,
  ev: 1.0,
  vot: 220,
  oaPct: 220 / 1200,
  simp: false,
};

const sampleAhu = {
  type: 'multizone' as const,
  method: 'appendixA' as const,
  psAuto: true,
  ps: 0,
  vpsAuto: true,
  vps: 0,
  zones: [],
};

export const Default: Story = {
  args: {
    ahu: sampleAhu,
    result: sampleMultiResult,
    open: true,
    onToggle: () => {},
  },
};

export const Collapsed: Story = {
  args: {
    ahu: sampleAhu,
    result: sampleMultiResult,
    open: false,
    onToggle: () => {},
  },
};
