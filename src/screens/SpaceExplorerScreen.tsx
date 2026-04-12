import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NASA_API_CONFIG } from '../config/api';
import { colors, spacing } from '../theme';

const { width } = Dimensions.get('window');

interface APODData {
  title: string;
  url: string;
  explanation: string;
  date: string;
}

interface MeteorData {
  name: string;
  diameter: string;
  isPotentiallyHazardous: boolean;
  missDistance: string;
  velocity: string;
}

export default function SpaceExplorerScreen() {
  const [apod, setApod] = useState<APODData | null>(null);
  const [meteors, setMeteors] = useState<MeteorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSpaceData();
  }, []);

  const fetchSpaceData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch APOD
      const apodRes = await fetch(`${NASA_API_CONFIG.BASE_URL}/planetary/apod?api_key=${NASA_API_CONFIG.API_KEY}`);
      if (apodRes.ok) {
        const apodJson = await apodRes.json();
        if (apodJson.url) {
          setApod({
            title: apodJson.title,
            url: apodJson.url,
            explanation: apodJson.explanation,
            date: apodJson.date
          });
        }
      }

      // 2. Fetch Near Earth Objects (NeoWs)
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`${NASA_API_CONFIG.BASE_URL}/neo/rest/v1/feed?start_date=${today}&end_date=${today}&api_key=${NASA_API_CONFIG.API_KEY}`);
      
      if (!response.ok) {
        const errText = await response.text();
        console.warn('NASA API Error Payload:', errText);
        throw new Error(`NASA API Link Failed: ${response.status}`);
      }

      const neoJson = await response.json();
      
      const objectsToday = neoJson.near_earth_objects?.[today] || [];
      const formattedMeteors = objectsToday.slice(0, 5).map((obj: any) => ({
        name: obj.name || 'Asteroid',
        diameter: obj.estimated_diameter?.meters?.estimated_diameter_max?.toFixed(1) || '0',
        isPotentiallyHazardous: !!obj.is_potentially_hazardous_asteroid,
        missDistance: obj.close_approach_data?.[0]?.miss_distance?.kilometers 
          ? Math.round(obj.close_approach_data[0].miss_distance.kilometers).toLocaleString() 
          : 'Unknown',
        velocity: obj.close_approach_data?.[0]?.relative_velocity?.kilometers_per_hour
          ? Math.round(obj.close_approach_data[0].relative_velocity.kilometers_per_hour).toLocaleString()
          : 'Unknown'
      }));
      setMeteors(formattedMeteors);

    } catch (err: any) {
      console.error('Space Data Sync Problem:', err);
      setError(err.message || 'Connection failed.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Traversing Deep Space...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {error ? (
        <View style={styles.errorCard}>
          <MaterialCommunityIcons name="satellite-variant" size={48} color="#000" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchSpaceData}>
            <Text style={styles.retryText}>RETRY SYNC</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Astro View</Text>
            <Text style={styles.sectionSubtitle}>Picture of the Day</Text>
          </View>

          {apod && (
            <View style={styles.apodCard}>
              <View style={styles.imageWrapper}>
                <Image source={{ uri: apod.url }} style={styles.apodImage} />
                <View style={styles.imageOverlay}>
                  <Text style={styles.overlayText}>{apod.date}</Text>
                </View>
              </View>
              <Text style={styles.apodTitle}>{apod.title}</Text>
              <Text style={styles.apodDescription} numberOfLines={4}>{apod.explanation}</Text>
            </View>
          )}

          <View style={[styles.sectionHeader, { marginTop: spacing.xl }]}>
            <Text style={styles.sectionTitle}>Meteor Watch</Text>
            <Text style={styles.sectionSubtitle}>Near Earth Objects Today</Text>
          </View>

          <View style={styles.meteorList}>
            {meteors.map((meteor, idx) => (
              <View key={idx} style={[styles.meteorCard, meteor.isPotentiallyHazardous && styles.hazHazardous]}>
                <View style={styles.meteorIcon}>
                  <MaterialCommunityIcons 
                    name={meteor.isPotentiallyHazardous ? "alert-decagram" : "meteor"} 
                    size={24} 
                    color={meteor.isPotentiallyHazardous ? "#EF4444" : "#000"} 
                  />
                </View>
                <View style={styles.meteorContent}>
                  <Text style={styles.meteorName}>{meteor.name.replace('(', '').replace(')', '')}</Text>
                  <Text style={styles.meteorStats}>
                    {meteor.diameter}m Dia • {meteor.velocity} km/h
                  </Text>
                  <Text style={styles.missDistance}>Miss by {meteor.missDistance} km</Text>
                </View>
                {meteor.isPotentiallyHazardous && (
                  <View style={styles.hazardBadge}>
                    <Text style={styles.hazardText}>ALERT</Text>
                  </View>
                )}
              </View>
            ))}
            {meteors.length === 0 && (
              <Text style={styles.emptyText}>No objects tracked in your vicinity today.</Text>
            )}
          </View>
        </>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.m },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: spacing.m, fontWeight: '700', color: colors.textPrimary, textTransform: 'uppercase' },
  sectionHeader: { marginBottom: spacing.m },
  sectionTitle: { fontSize: 32, fontWeight: '900', color: '#000', textTransform: 'uppercase', letterSpacing: -1 },
  sectionSubtitle: { fontSize: 16, fontWeight: '700', color: '#666' },
  apodCard: {
    backgroundColor: '#FFF',
    borderWidth: 4,
    borderColor: '#000',
    borderRadius: 24,
    padding: spacing.m,
    shadowColor: '#000',
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  imageWrapper: { borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: '#000', marginBottom: spacing.m },
  apodImage: { width: '100%', height: 200, resizeMode: 'cover' },
  imageOverlay: { position: 'absolute', bottom: 10, left: 10, backgroundColor: '#FFD500', paddingHorizontal: 10, paddingVertical: 4, borderWidth: 2, borderColor: '#000' },
  overlayText: { fontWeight: '900', fontSize: 10 },
  apodTitle: { fontSize: 20, fontWeight: '900', color: '#000', marginBottom: spacing.s },
  apodDescription: { fontSize: 14, color: '#444', lineHeight: 20, fontWeight: '600' },
  meteorList: { gap: spacing.m },
  meteorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: 20,
    padding: spacing.m,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  hazHazardous: { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },
  meteorIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginRight: spacing.m },
  meteorContent: { flex: 1 },
  meteorName: { fontSize: 16, fontWeight: '900', color: '#000' },
  meteorStats: { fontSize: 12, color: '#666', fontWeight: '700', marginTop: 2 },
  missDistance: { fontSize: 11, color: '#999', fontWeight: '600', marginTop: 1 },
  hazardBadge: { backgroundColor: '#EF4444', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  hazardText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  emptyText: { textAlign: 'center', color: '#999', fontStyle: 'italic', marginTop: spacing.l },
  errorCard: { padding: 40, alignItems: 'center', backgroundColor: '#FFD500', borderWidth: 4, borderColor: '#000', borderRadius: 24 },
  errorText: { marginTop: 20, fontWeight: '900', textAlign: 'center', fontSize: 18 },
  retryButton: { marginTop: 30, backgroundColor: '#000', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: '#FFF', fontWeight: '900' },
});
