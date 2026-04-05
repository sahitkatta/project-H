import React from 'react';

type BadgeVariant =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'completed'
  | 'owner'
  | 'manager'
  | 'cashier'
  | 'cash'
  | 'card'
  | 'cheque'
  | 'zelle'
  | 'mix';

interface BadgeProps {
  variant: BadgeVariant;
  children?: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  pending: 'bg-amber-100 text-amber-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  completed: 'bg-blue-100 text-blue-800',
  owner: 'bg-purple-100 text-purple-800',
  manager: 'bg-blue-100 text-blue-800',
  cashier: 'bg-gray-100 text-gray-800',
  cash: 'bg-green-100 text-green-800',
  card: 'bg-blue-100 text-blue-800',
  cheque: 'bg-orange-100 text-orange-800',
  zelle: 'bg-teal-100 text-teal-800',
  mix: 'bg-indigo-100 text-indigo-800',
};

const defaultLabels: Record<BadgeVariant, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  completed: 'Completed',
  owner: 'Owner',
  manager: 'Manager',
  cashier: 'Cashier',
  cash: 'Cash',
  card: 'Card',
  cheque: 'Cheque',
  zelle: 'Zelle',
  mix: 'Mix',
};

export function Badge({ variant, children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {children ?? defaultLabels[variant]}
    </span>
  );
}
