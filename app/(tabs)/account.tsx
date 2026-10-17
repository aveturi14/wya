import AssistantSwitches from '@/components/AssistantSwitches';
import GetPaidCard from '@/components/pledges/GetPaidCard';
import { OwesFlag, ReliabilityText, useReliability } from '@/components/pledges/Reliability';
import { Avatar } from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import PressableScale from '@/components/ui/PressableScale';
import TabScreen from '@/components/ui/TabScreen';
import Segmented from '@/components/ui/Segmented';
import TextField from '@/components/ui/TextField';
import { Radius, Space } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { makeStyles, ThemePreference, useTheme } from '@/hooks/useTheme';
import { confirmAction, showAlert } from '@/lib/alert';
import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/upload';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
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

  return (
    <TabScreen keyboardAvoiding contentContainerStyle={styles.content}>
          <Text style={theme.type.display}>You</Text>

          <View style={styles.profile}>
            <PressableScale onPress={pickAvatar} style={styles.avatarWrap} accessibilityLabel="Change profile photo">
              <Avatar name={profile?.full_name ?? user?.email ?? 'U'} url={profile?.avatar_url} seed={user?.id ?? 'me'} size={104} />
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={15} color={theme.colors.onSecondary} />
              </View>
            </PressableScale>
            <Text style={theme.type.title}>{profile?.full_name ?? 'Set your name'}</Text>
            <Text style={theme.type.bodySecondary}>{user?.email}</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={theme.type.heading}>Profile</Text>
              {!editing && (
                <Button
                  title="Edit"
                  icon="pencil"
                  variant="outline"
                  size="sm"
                  onPress={() => { setFullName(profile?.full_name ?? ''); setPhone(profile?.phone ?? ''); setEditing(true); }}
                />
              )}
            </View>
            {editing ? (
              <Card style={{ gap: Space.lg }}>
                <TextField label="Name" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
                <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                <View style={styles.editActions}>
                  <Button title="Cancel" variant="ghost" onPress={() => setEditing(false)} style={{ flex: 1 }} />
                  <Button title="Save" loading={saving} onPress={saveProfile} style={{ flex: 1 }} />
                </View>
              </Card>
            ) : (
              <Card padded={false}>
                <InfoRow icon="person" label="Name" value={profile?.full_name ?? '—'} />
                <InfoRow icon="call" label="Phone" value={profile?.phone ?? '—'} divider />
                <InfoRow icon="mail" label="Email" value={user?.email ?? '—'} divider />
              </Card>
            )}
          </View>

          <View style={styles.section}>
            <Text style={theme.type.heading}>Get paid</Text>
            <GetPaidCard />
          </View>

          <View style={styles.section}>
            <Text style={theme.type.heading}>Your reliability</Text>
            <Card style={{ gap: Space.xs }}>
              <ReliabilityText record={reliability} />
              <Text style={theme.type.caption}>Hosts see this when you're invited to their events.</Text>
              <OwesFlag record={reliability} />
            </Card>
          </View>

          <AssistantSwitches />

          <View style={styles.section}>
            <Text style={theme.type.heading}>Appearance</Text>
            <Segmented<ThemePreference>
              options={[{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
              value={preference}
              onChange={setPreference}
            />
            <Text style={theme.type.caption}>Auto follows your phone or browser setting.</Text>
          </View>

          <Button
            title="Sign out"
            icon="log-out-outline"
            variant="danger"
            onPress={async () => {
              if (await confirmAction('Sign out', 'Are you sure you want to sign out?', 'Sign out', true)) signOut();
            }}
          />
    </TabScreen>
  );
}

function InfoRow({ icon, label, value, divider }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; divider?: boolean }) {
  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.infoRow, divider && styles.infoDivider]}>
      <View style={styles.infoIcon}><Ionicons name={icon} size={16} color={theme.colors.onHighlight} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={theme.type.caption}>{label}</Text>
        <Text style={theme.type.value}>{value}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  // Phones: TabScreen sets the top and bottom padding (safe area, floating bar)
  content: { padding: Space.xl, paddingTop: Space.xxxl, gap: Space.xxl },
  profile: { alignItems: 'center', gap: Space.sm },
  avatarWrap: { marginBottom: Space.sm },
  cameraBadge: {
    position: 'absolute', bottom: 2, right: 2, width: 32, height: 32, borderRadius: 16, backgroundColor: t.colors.secondary,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: t.isDark ? t.colors.background : t.colors.outline,
  },
  section: { gap: Space.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editActions: { flexDirection: 'row', gap: Space.sm },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.lg },
  infoDivider: { borderTopWidth: 1, borderTopColor: t.colors.border },
  infoIcon: { width: 32, height: 32, borderRadius: Radius.sm, backgroundColor: t.colors.highlight, justifyContent: 'center', alignItems: 'center' },
}));
