import type { Meta, StoryObj } from '@storybook/react';
import { App } from './App';

const meta = {
  title: 'App/Full',
  component: App,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof App>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
