import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { MethodSwitcher } from './MethodSwitcher';

const meta = {
  title: 'Components/MethodSwitcher',
  component: MethodSwitcher,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    method: 'appendixA',
    simplifiedMethod: 'table6-3',
    onChange: () => {},
    onSimplifiedMethodChange: () => {},
  },
  render: (args) => {
    const [method, setMethod] = useState<'appendixA' | 'simplified'>(args.method);
    const [sm, setSm] = useState<'table6-3' | 'eq6-7-6-8'>(args.simplifiedMethod);
    return (
      <MethodSwitcher
        {...args}
        method={method}
        simplifiedMethod={sm}
        onChange={(m) => {
          setMethod(m);
          args.onChange(m);
        }}
        onSimplifiedMethodChange={(s) => {
          setSm(s);
          args.onSimplifiedMethodChange(s);
        }}
      />
    );
  },
} satisfies Meta<typeof MethodSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AppendixA: Story = {
  args: { method: 'appendixA', simplifiedMethod: 'table6-3' },
};

export const Simplified: Story = {
  args: { method: 'simplified', simplifiedMethod: 'table6-3' },
};

export const SimplifiedWithEq678: Story = {
  args: { method: 'simplified', simplifiedMethod: 'eq6-7-6-8' },
};
