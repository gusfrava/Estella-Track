import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { TextButton, Txt } from '@/components/native-ui';
import { billing } from '@/services/revenuecat';

// Development-only diagnostics. No purchase UI and no entitlement grants.
export function RevenueCatStatus({ lang }) {
  const [state, setState] = useState(billing.getState);
  useEffect(() => billing.subscribe(setState), []);
  if (!__DEV__) return null;
  const es = lang === 'es';
  return <View style={{ gap: 6 }}>
    <Txt bold>RevenueCat · Test Store</Txt>
    <Txt selectable>{state.userId || (es ? 'Inicia sesión para conectar tu cuenta.' : 'Sign in to connect your account.')}</Txt>
    <Txt>{state.status}{state.plus === null ? '' : state.plus ? ' · Estella Plus' : ' · Free'}</Txt>
    {!!state.offerings && <Txt>{Object.keys(state.offerings.all || {}).join(', ')}</Txt>}
    {!!state.error && <Txt>{state.error}</Txt>}
    <TextButton title={es ? 'Actualizar conexión' : 'Refresh connection'} onPress={() => { void billing.refresh(); }} />
  </View>;
}
