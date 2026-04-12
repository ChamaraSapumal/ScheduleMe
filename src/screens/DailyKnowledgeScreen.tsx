import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  LayoutAnimation, 
  Platform, 
  UIManager, 
  ActivityIndicator, 
  Image, 
  RefreshControl 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';

// LayoutAnimation is handled automatically in the New Architecture
// No extra configuration needed

interface DailyInsight {
  category: string;
  icon: string;
  color: string;
  fact: string;
  details: string;
  image?: string;
  source: 'Wikipedia' | 'NASA' | 'Local';
}

const localFacts: Omit<DailyInsight, 'source'>[] = [
  { 
    category: "AI & ML", icon: "robot-outline", color: "#3B82F6", 
    fact: "The concept of 'Machine Learning' was coined in 1959 by Arthur Samuel, an IBM pioneer in computer gaming and artificial intelligence.",
    details: "Arthur Samuel developed a checkers-playing program that learned from its mistakes and improved over time. It was one of the world's first successful self-learning programs. He defined machine learning as 'the field of study that gives computers the ability to learn without being explicitly programmed', paving the way for modern AI architectures."
  },
  { 
    category: "SpaceX", icon: "rocket-launch-outline", color: "#EF4444", 
    fact: "SpaceX's Falcon Heavy is the most powerful operational rocket in the world by a factor of two, capable of lifting nearly 64 metric tons.",
    details: "First launched in 2018 (carrying Elon Musk's personal Tesla Roadster into space), the Falcon Heavy consists of three Falcon 9 nine-engine cores. Its massive payload capacity allows it to carry missions to the Moon or Mars. Remarkably, the side boosters are designed to return to Earth and land simultaneously, significantly reducing launch costs."
  },
  { 
    category: "NASA", icon: "earth", color: "#8B5CF6", 
    fact: "NASA's Voyager 1 spacecraft, launched in 1977, is the most distant human-made object and has officially entered interstellar space.",
    details: "Voyager 1 crossed the heliopause—the boundary where the sun's solar wind is stopped by the interstellar medium—in August 2012. It carries the 'Golden Record,' a phonograph record containing sounds and images selected to portray the diversity of life and culture on Earth, intended for any intelligent extraterrestrial life form who might find it."
  },
  { 
    category: "Mechanical", icon: "cog-outline", color: "#F59E0B", 
    fact: "The Antikythera mechanism, discovered in an ancient Greek shipwreck, is considered the world's oldest known analog computer, dating back to 100 BC.",
    details: "Discovered in 1901 off the coast of the Greek island Antikythera, this intricate bronze instrument relied on dozens of highly precise, interlocking gears. It was used to predict astronomical positions and eclipses for calendrical and astrological purposes decades in advance. The level of mechanical sophistication it displayed was not seen again until European clockmaking began in the 14th century."
  },
];

export default function DailyKnowledgeScreen() {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [insight, setInsight] = useState<DailyInsight | null>(null);

  const fetchInsight = useCallback(async (isRandom: boolean = false) => {
    try {
      if (!isRandom) setLoading(true);
      
      let attempts = 0;
      let validItem: any = null;

      while (attempts < 3 && !validItem) {
        const url = isRandom 
          ? `https://dev.to/api/articles?tag=ai&per_page=20&page=${Math.floor(Math.random() * 5) + 1}`
          : 'https://dev.to/api/articles?tag=ai&per_page=1';

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Dev.to API error: ${response.status}`);
        
        const data = await response.json();
        const item = isRandom && Array.isArray(data) && data.length > 0 
           ? data[Math.floor(Math.random() * data.length)] 
           : (Array.isArray(data) ? data[0] : data);

        if (item && item.title) {
          validItem = item;
        }
        attempts++;
      }

      if (!validItem) throw new Error("Could not find tech news");

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setInsight({
        category: "AI & Tech News",
        icon: "robot-outline",
        color: "#3B82F6", // Bright Blue for Tech
        fact: validItem.title,
        details: validItem.description + "\n\nAuthor: " + (validItem.user?.name || "Unknown"),
        image: validItem.cover_image || validItem.social_image || undefined,
        source: 'Dev.to'
      });
      
    } catch (error: any) {
      console.warn("Dev.to fetch failed, using local facts:", error.message);
      const d = new Date();
      const start = new Date(d.getFullYear(), 0, 0);
      const diff = (d.getTime() - start.getTime()) + ((start.getTimezoneOffset() - d.getTimezoneOffset()) * 60 * 1000);
      const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      const index = isRandom 
        ? Math.floor(Math.random() * localFacts.length)
        : dayOfYear % localFacts.length;

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setInsight({ ...localFacts[index], source: 'Local' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInsight();
  }, [fetchInsight]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchInsight(); // Normal daily refresh
  };

  const shuffleKnowledge = () => {
    setExpanded(false);
    fetchInsight(true); // Random knowledge
  };

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSecondary, marginTop: spacing.m }}>Deep diving for knowledge...</Text>
      </View>
    );
  }

  if (!insight) return null;

  return (
    <View style={styles.container}>
      <ScrollView 
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={{ padding: spacing.m }}
      >
        <View style={styles.screenHeader}>
          <Text style={styles.screenGreeting}>Discover something new today</Text>
          <TouchableOpacity style={styles.shuffleIconBtn} onPress={shuffleKnowledge}>
            <MaterialCommunityIcons name="cached" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.tagContainer}>
              <MaterialCommunityIcons name={insight.icon as any} size={18} color={insight.color} />
              <Text style={[styles.categoryTag, { color: insight.color }]}>{insight.category}</Text>
            </View>
            <View style={styles.sourceBadge}>
               <Text style={styles.sourceText}>{insight.source}</Text>
            </View>
          </View>
          
          {insight.image && (
            <Image 
              source={{ uri: insight.image }} 
              style={styles.insightImage} 
              resizeMode="cover"
            />
          )}

          <Text style={styles.factText}>"{insight.fact}"</Text>
          
          {expanded && (
            <View style={styles.detailsContainer}>
              <View style={styles.divider} />
              <Text style={styles.detailsTitle}>The Full Story</Text>
              <Text style={styles.detailsText}>{insight.details}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.readMoreBtn} onPress={toggleExpand}>
            <Text style={styles.readMoreText}>{expanded ? 'Show Less' : 'Full Details'}</Text>
            <MaterialCommunityIcons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity style={styles.footerShuffleBtn} onPress={shuffleKnowledge}>
            <MaterialCommunityIcons name="shuffle-variant" size={20} color={colors.textDark} />
            <Text style={styles.footerShuffleText}>Surprise Me</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.m,
    paddingHorizontal: spacing.s,
  },
  shuffleIconBtn: {
    position: 'absolute',
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 8,
    borderRadius: 12,
  },
  screenGreeting: { 
    color: colors.textSecondary, 
    fontSize: 16, 
    fontStyle: 'italic',
    flex: 1,
    textAlign: 'center'
  },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: spacing.l,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 5,
  },
  insightImage: {
    width: '100%',
    height: 220,
    borderRadius: 15,
    marginBottom: spacing.m,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.l,
  },
  sourceBadge: {
    backgroundColor: 'rgba(91, 194, 216, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sourceText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  tagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  categoryTag: {
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 6,
    textTransform: 'uppercase',
    maxWidth: 180,
  },
  dailyTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  factText: {
    color: colors.textPrimary,
    fontSize: 19,
    fontStyle: 'italic',
    lineHeight: 28,
    marginBottom: spacing.m,
    fontWeight: '300',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: spacing.m,
  },
  detailsContainer: {
    marginBottom: spacing.m,
  },
  detailsTitle: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: spacing.s,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  detailsText: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
  },
  readMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.m,
    marginTop: spacing.s,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  readMoreText: {
    color: colors.textPrimary,
    fontWeight: '600',
    marginRight: 4,
  },
  footerShuffleBtn: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    borderRadius: 25,
    marginTop: spacing.xl,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  footerShuffleText: {
    color: colors.textDark,
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  }
});
