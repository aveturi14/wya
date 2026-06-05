import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Type } from '@/constants/typography';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function AccountScreen() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const response = await fetch(uri);
      const blob = await response.blob();
      const ext = uri.split('.').pop() ?? 'jpg';
      const path = `${user!.id}/avatar.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: `image/${ext}` });
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
        await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user!.id);
        await refreshProfile();
      }
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ full_name: fullName, phone }).eq('id', user!.id);
    if (error) Alert.alert('Error', error.message);
    else { await refreshProfile(); setEditing(false); }
    setSaving(false);
  };

  const initial = (profile?.full_name ?? user?.email ?? 'U')[0].toUpperCase();

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Header with glow */}
        <View style={styles.headerWrap}>
          <View style={styles.headerGlow} />
          <Text style={styles.title}>Account</Text>
        </View>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickAvatar} style={styles.avatarWrap} activeOpacity={0.8}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
            <View style={styles.avatarEdit}>
              <Ionicons name="camera" size={13} color={Colors.white} />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarName}>{profile?.full_name ?? 'Set your name'}</Text>
          <Text style={styles.avatarEmail}>{user?.email}</Text>
        </View>

        {/* Profile card */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Profile</Text>
            {!editing && (
              <TouchableOpacity style={styles.editPill} onPress={() => { setFullName(profile?.full_name ?? ''); setPhone(profile?.phone ?? ''); setEditing(true); }}>
                <Ionicons name="pencil-outline" size={13} color={Colors.accentMid} />
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.card}>
            <InfoRow icon="person-outline" label="Name" value={
              editing
                ? <TextInput style={styles.inlineInput} value={fullName} onChangeText={setFullName} placeholderTextColor={Colors.textMuted} />
                : <Text style={styles.infoValue}>{profile?.full_name ?? '—'}</Text>
            } />
            <View style={styles.divider} />
            <InfoRow icon="call-outline" label="Phone" value={
              editing
                ? <TextInput style={styles.inlineInput} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor={Colors.textMuted} />
                : <Text style={styles.infoValue}>{profile?.phone ?? '—'}</Text>
            } />
            <View style={styles.divider} />
            <InfoRow icon="mail-outline" label="Email" value={<Text style={styles.infoValue}>{user?.email}</Text>} />
          </View>

          {editing && (
            <View style={styles.editActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={saving}>
                {saving ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Sign out */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={() => Alert.alert('Sign Out', 'Are you sure?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign Out', style: 'destructive', onPress: signOut }])}
          >
            <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={17} color={Colors.accent} style={styles.infoIcon} />
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoValueWrap}>{value}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 80 },

  headerWrap: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 8, overflow: 'hidden' },
  headerGlow: { position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: Colors.accentGlow, opacity: 0.45 },
  title: { fontSize: 36, fontFamily: Fonts.displayBold, color: Colors.text, letterSpacing: -0.5 },

  avatarSection: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: { backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 8 },
  avatarInitial: { fontSize: 42, fontFamily: Fonts.displayBold, color: Colors.white },
  avatarEdit: { position: 'absolute', bottom: 2, right: 2, backgroundColor: Colors.accentMid, borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.background },
  avatarName: { fontSize: 22, fontFamily: Fonts.displayBold, color: Colors.text, letterSpacing: -0.2 },
  avatarEmail: { fontSize: 13, fontFamily: Fonts.body, color: Colors.textSecondary },

  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontFamily: Fonts.bodySemiBold, color: Colors.textSecondary, letterSpacing: 1.2, textTransform: 'uppercase' },
  editPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.accentSubtle, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  editBtnText: { fontFamily: Fonts.bodySemiBold, color: Colors.accentMid, fontSize: 13 },

  card: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15 },
  infoIcon: { marginRight: 14 },
  infoLabel: { fontFamily: Fonts.bodyMedium, color: Colors.textSecondary, fontSize: 13, width: 72 },
  infoValueWrap: { flex: 1 },
  infoValue: { fontFamily: Fonts.body, color: Colors.text, fontSize: 15 },
  inlineInput: { fontFamily: Fonts.body, color: Colors.text, fontSize: 15, borderBottomWidth: 1, borderBottomColor: Colors.accent, paddingBottom: 2 },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 48 },

  editActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  cancelBtnText: { fontFamily: Fonts.bodySemiBold, color: Colors.textSecondary },
  saveBtn: { flex: 2, borderRadius: 12, paddingVertical: 13, alignItems: 'center', backgroundColor: Colors.accent, shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  saveBtnText: { fontFamily: Fonts.bodySemiBold, color: Colors.white },

  signOutBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.dangerSubtle, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 15, borderWidth: 1, borderColor: Colors.danger + '22' },
  signOutText: { fontFamily: Fonts.bodySemiBold, color: Colors.danger, fontSize: 15 },
});
