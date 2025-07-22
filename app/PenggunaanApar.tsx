// app/TataCaraPenggunaan.tsx

import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, ScrollView } from 'react-native';
import styled from 'styled-components/native';

const steps = [
  {
    key: '1',
    icon: 'pin',
    title: 'Lepaskan Pin Pengaman',
    description: 'Tarik pin pengaman pada tuas APAR untuk membuka kunci tuas.',
  },
  {
    key: '2',
    icon: 'center-focus-weak',
    title: 'Arahkan Selang',
    description: 'Arahkan selang ke pangkal api atau ke dasar kobaran api.',
  },
  {
    key: '3',
    icon: 'play-arrow',
    title: 'Tekan Tuas',
    description: 'Tekan tuas APAR untuk memulai pelepasan media pemadam.',
  },
  {
    key: '4',
    icon: 'rotate-left',
    title: 'Sapu Media',
    description: 'Sapu media pemadam secara menyilang untuk memadamkan api.',
  },
  {
    key: '5',
    icon: 'notification-important',
    title: 'Laporkan Jika Perlu',
    description: 'Laporkan ke regu pemadam kebakaran jika api belum padam.',
  },
];

const Colors = {
  primary: '#D50000',
  background: '#FFFFFF',
  text: '#212121',
  subtext: '#616161',
  card:    '#FFFFFF',
  shadow:  'rgba(0,0,0,0.1)',
};

const Container = styled.SafeAreaView`
  flex: 1;
  background-color: ${Colors.background};
`;

const Header = styled.View`
  padding: 30px 16px 20px;
  background-color: ${Colors.primary};
`;
const HeaderTitle = styled.Text`
  color: #fff;
  font-size: 22px;
  font-weight: bold;
`;
const HeaderDesc = styled.Text`
  color: #fff;
  font-size: 14px;
  margin-top: 4px;
`;

const Step = styled.View`
  flex-direction: row;
  background-color: ${Colors.card};
  margin: 8px 16px;
  padding: 16px;
  border-radius: 8px;
  elevation: 2;
  shadow-color: ${Colors.shadow};
  shadow-offset: 0px 1px;
  shadow-opacity: 1;
  shadow-radius: 2px;
`;
const IconWrapper = styled.View`
  margin-right: 12px;
`;
const Info = styled.View`
  flex: 1;
`;
const StepTitle = styled.Text`
  font-size: 16px;
  font-weight: 600;
  color: ${Colors.text};
`;
const StepDesc = styled.Text`
  font-size: 14px;
  color: ${Colors.subtext};
  margin-top: 4px;
`;

export default function TataCaraPenggunaan() {
  const animations = useRef(steps.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // staggered fade-in + slide-up
    const anims = animations.map((a, i) =>
      Animated.timing(a, {
        toValue: 1,
        duration: 500,
        delay: i * 200,
        useNativeDriver: true,
      })
    );
    Animated.stagger(100, anims).start();
  }, [animations]);

  return (
    <Container>
      <Header>
        <HeaderTitle>Tata Cara Penggunaan APAR</HeaderTitle>
        <HeaderDesc>
          Ikuti langkah-langkah berikut untuk menggunakan alat pemadam api ringan (APAR).
        </HeaderDesc>
      </Header>

      <ScrollView contentContainerStyle={{ paddingVertical: 16 }}>
        {steps.map((step, index) => {
          const opacity = animations[index];
          const translateY = opacity.interpolate({
            inputRange: [0, 1],
            outputRange: [20, 0],
          });

          return (
            <Animated.View
              key={step.key}
              style={{
                opacity,
                transform: [{ translateY }],
              }}
            >
              <Step>
                <IconWrapper>
                  <MaterialIcons name={step.icon} size={32} color={Colors.primary} />
                </IconWrapper>
                <Info>
                  <StepTitle>{step.title}</StepTitle>
                  <StepDesc>{step.description}</StepDesc>
                </Info>
              </Step>
            </Animated.View>
          );
        })}
      </ScrollView>
    </Container>
  );
}
