import type { Meta, StoryObj } from '@storybook/react';
import { EzHelpDialog } from './EzHelpDialog';
import { EZ_CONFIGS } from '../lib/tables';

const meta = {
  title: 'Components/EzHelpDialog',
  component: EzHelpDialog,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof EzHelpDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    rows: EZ_CONFIGS,
    onClose: () => {},
  },
};
