import { Box, Card, CardContent, Typography, Skeleton } from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { useQuery } from '@tanstack/react-query';
import { tradingService } from '@/api/trading';

interface Props {
  clientId: string;
}

function fmt(v: string | number) {
  return `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function FundsWidget({ clientId }: Props) {
  const { data: fund, isLoading } = useQuery({
    queryKey: ['fund', clientId],
    queryFn: () => tradingService.getFunds(clientId).then((r) => r.data),
    enabled: !!clientId,
    refetchInterval: 10000,
  });

  if (isLoading || !fund) {
    return <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 2 }} />;
  }

  const items = [
    { label: 'Available', value: fund.available, color: '#2e7d32' },
    { label: 'Used',      value: fund.used,      color: '#c62828' },
    { label: 'Total',     value: fund.total,      color: '#1a237e' },
  ];

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <AccountBalanceWalletIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
            Margin
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 3 }}>
          {items.map(({ label, value, color }) => (
            <Box key={label}>
              <Typography variant="caption" color="text.secondary">{label}</Typography>
              <Typography variant="body2" fontWeight={700} color={color}>
                {fmt(value)}
              </Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}
