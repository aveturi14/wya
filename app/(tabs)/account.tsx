import AssistantSwitches from '@/components/AssistantSwitches';
import GetPaidCard from '@/components/pledges/GetPaidCard';
import { useMyPayid } from '@/components/pledges/GetPaidCard';
import { OwesFlag, useReliability } from '@/components/pledges/Reliability';
import { Avatar } from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import ListRow, { ListGroup } from '@/components/ui/ListRow';
import PressableScale from '@/components/ui/PressableScale';
import TabScreen from '@/components/ui/TabScreen';
import Segmented from '@/components/ui/Segmented';
import Sheet from '@/components/ui/Sheet';
import TextField from '@/components/ui/TextField';
import { Fonts, Space } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { sumDues, useDues } from '@/lib/dues';
import { billMoney } from '@/lib/receipts';
import { useRouter } from 'expo-router';
import { usePageTitle } from '@/hooks/usePageTitle';
import { makeStyles, ThemePreference, useTheme } from '@/hooks/useTheme';
import { confirmAction, showAlert } from '@/lib/alert';
import { getProvider } from '@/lib/payments';
import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/upload';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

export default function AccountScreen() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { theme, preference, setPreference } = useTheme();
  const styles = useStyles();
  usePageTitle('You');
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const reliability = useReliability(user?.id);
  const [sheet, setSheet] = useState<'payid' | 'assistant' | null>(null);
  const [hosted, setHosted] = useState<number | null>(null);
  const { payid, reload: reloadPayid } = useMyPayid();
  const provider = getProvider();
  const payidLine = payid ? `${provider.label} · ${provider.format(payid)}` : 'Add one so people who owe you know where to pay';

  // How many events you've hosted (8.5's host record, for yourself)
  useEffect(() => {
    if (!user) return;
    supabase.rpc('get_host_record', { p_host_id: user.id }).then(({ data }) => setHosted(data?.[0]?.hosted ?? 0));
  }, [user]);

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled) return;
    try {
      // One file per user, replaced in place; the version param busts cached copies of the old image
      const publicUrl = await uploadImage('avatars', `${user!.id}/avatar`, result.assets[0], { fixedName: true });
      const { error } = await supabase.from('profiles').update({ avatar_url: `${publicUrl}?v=${Date.now()}` }).eq('id', user!.id);
      if (error) throw error;
      await refreshProfile();
    } catch (e: any) {
      showAlert('Could not update photo', e?.message ?? 'Please try again.');
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ full_name: fullName, phone }).eq('id', user!.id);
    if (error) showAlert('Error', error.message);
    else { await refreshProfile(); setEditing(false); }
    setSaving(false);
  };

  const openProfile = () => { setFullName(profile?.full_name ?? ''); setPhone(profile?.phone ?? ''); setEditing(true); };
  const record = reliability && reliability.counted > 0 ? `${reliability.attended} of ${reliability.counted}` : '—';

  return (
    <TabScreen keyboardAvoiding contentContainerStyle={styles.content}>
      <View style={styles.profile}>
        <PressableScale onPress={pickAvatar} style={styles.avatarWrap} accessibilityLabel="Change profile photo">
          <Avatar name={profile?.full_name ?? user?.email ?? 'U'} url={profile?.avatar_url} seed={user?.id ?? 'me'} size={56} />
          <View style={styles.cameraBadge}>
            <Ionicons name="camera" size={12} color={theme.colors.onPrimary} />
          </View>
        </PressableScale>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={theme.type.heading} numberOfLines={1} accessibilityRole="header">{profile?.full_name ?? 'Set your name'}</Text>
          <Text style={theme.type.caption} numberOfLines={1}>{user?.email}</Text>
        </View>
      </View>

      {/* Your record as a big number: hosts see it when you're invited */}
      <Card style={styles.stats}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={theme.type.label}>Came to</Text>
          <Text style={theme.type.stat}>{record}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={theme.type.label}>Hosted</Text>
          <Text style={theme.type.stat}>{hosted ?? '—'}</Text>
        </View>
      </Card>
      <OwesFlag record={reliability} />

      <ListGroup>
        <DuesRow />
        <ListRow icon="lock-closed-outline" title="Get paid by PayID" subtitle={payidLine} chevron onPress={() => setSheet('payid')} />
        <ListRow icon="person-outline" title="Profile" subtitle="Name, email, phone" chevron onPress={openProfile} />
        <ListRow icon="flash-outline" title="wya assistant" subtitle="What it can suggest for you" chevron onPress={() => setSheet('assistant')} />
      </ListGroup>

      <Card style={{ gap: Space.sm }}>
        <Text style={theme.type.label}>Appearance</Text>
        <Segmented<ThemePreference>
          stretch
          options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'Auto' }]}
          value={preference}
          onChange={setPreference}
        />
        <Text style={theme.type.caption}>Auto follows your phone or browser setting.</Text>
      </Card>

      {/* Sign out sits apart */}
      <Button
        title="Sign out"
        icon="log-out-outline"
        variant="danger"
        size="lg"
        style={{ marginTop: Space.lg }}
        onPress={async () => {
          if (await confirmAction('Sign out', 'Are you sure you want to sign out?', 'Sign out', true)) signOut();
        }}
      />

      <Sheet
        visible={editing}
        onClose={() => setEditing(false)}
        title="Profile"
        footer={<Button title="Save" loading={saving} onPress={saveProfile} />}
      >
        <TextField label="Name" value={fullName} onChangeText={setFullName} autoCapitalize="words" autoComplete="name" />
        <TextField label="Phone" optional value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
        <TextField label="Email" value={user?.email ?? ''} editable={false} />
      </Sheet>
      <Sheet visible={sheet === 'payid'} onClose={() => { setSheet(null); reloadPayid(); }} title={<Text style={theme.type.title}>Get <Text style={styles.serif}>paid</Text></Text>}>
        <GetPaidCard />
      </Sheet>
      <Sheet visible={sheet === 'assistant'} onClose={() => setSheet(null)} title={<Text style={theme.type.title}>wya <Text style={styles.serif}>assistant</Text></Text>}>
        <AssistantSwitches heading={false} />
      </Sheet>
    </TabScreen>
  );
}

/** What you owe and are owed across every event (8.18), one tap from the full list. */
function DuesRow() {
  const router = useRouter();
  const { dues } = useDues();
  const t = sumDues(dues ?? []);
  const summary = dues == null ? '…'
    : t.owe === 0 && t.owed === 0 && t.pendingOwe === 0 && t.pendingOwed === 0 ? "You're all square with everyone"
    : [t.owe > 0 && `You owe ${billMoney(t.owe)}`, t.owed > 0 && `owed ${billMoney(t.owed)}`,
       (t.pendingOwe > 0 || t.pendingOwed > 0) && 'bills being worked out'].filter(Boolean).join(' · ');
  return <ListRow icon="list-outline" title="Your dues" subtitle={summary} chevron onPress={() => router.push('/dues')} />;
}

const useStyles = makeStyles((t) => ({
  // Phones: TabScreen sets the top and bottom padding (safe area, floating bar)
  content: { paddingHorizontal: Space.lg, paddingTop: Space.md, gap: Space.md },
  profile: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingBottom: Space.sm },
  avatarWrap: { borderRadius: 30 },
  cameraBadge: {
    position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: t.colors.primary,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: t.colors.background,
  },
  stats: { flexDirection: 'row', gap: Space.md },
  serif: { fontFamily: Fonts.serif, fontSize: 31 },
}));
