<script lang="ts" setup>
import { ref, watch } from "vue";

import Mint from "@/components/popups/Mint.vue";
import WalletConnect from "@/components/popups/WalletConnect.vue";
import Icon from "@/components/ui/Icon.vue";
import { useWallet } from "@/composables/useWallet.ts";

const Wallet = useWallet();
const securityLink = "https://github.com/allinbits/security/";
const isOpen = ref(false);

const openDrawer = () => {
  isOpen.value = true;
};

const closeDrawer = () => {
  isOpen.value = false;
};

// Prevent body scroll when drawer is open
watch(
  isOpen,
  (open) => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }
);

defineExpose({ openDrawer });
</script>

<template>
  <div>
    <!-- Hamburger Menu Button -->
    <button
      class="p-4 text-light hover:text-grey-100 duration-200"
      @click="openDrawer"
      aria-label="Menu"
    >
      <Icon icon="menu" :size="1.5" />
    </button>

    <!-- Backdrop -->
    <Transition name="backdrop-fade">
      <div
        v-if="isOpen"
        class="p-4 fixed inset-0 bg-black bg-opacity-50 z-40"
        @click="closeDrawer"
      ></div>
    </Transition>

    <!-- Drawer Panel -->
    <Transition name="drawer-slide">
      <div
        v-if="isOpen"
        class="fixed top-0 right-0 h-full w-80 bg-grey-500 z-50 shadow-2xl overflow-y-auto"
      >
        <div class="flex flex-col h-full">
          <!-- Header -->
          <div class="flex items-center justify-between p-6 border-b border-grey-300">
            <button
              class="p-2 text-light hover:text-grey-100 duration-200"
              @click="closeDrawer"
              aria-label="Close menu"
            >
              <Icon icon="close" :size="1.5" />
            </button>
          </div>

          <!-- Content -->
          <div class="flex flex-col gap-6 p-6 flex-grow">
            <!-- Wallet Connect Section -->
            <WalletConnect />

            <!-- Mint Photon Button (only when logged in) -->
            <div v-if="Wallet.loggedIn.value">
              <Mint />
            </div>

            <!-- Divider -->
            <hr class="border-grey-300" />

            <!-- Navigation Links -->
            <nav class="flex flex-col gap-2">
              <router-link
                active-class="text-light bg-grey-300"
                to="/faq"
                class="text-300 py-4 px-4 hover:bg-grey-300 hover:text-light text-grey-100 rounded duration-200"
                @click="closeDrawer"
              >
                {{ $t("homepage.viewFaq") }}
              </router-link>

              <a
                :href="securityLink"
                target="_blank"
                class="text-300 py-4 px-4 hover:bg-grey-300 hover:text-light text-grey-100 rounded duration-200"
              >
                {{ $t("homepage.security") }}
              </a>
            </nav>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Backdrop transitions */
.backdrop-fade-enter-active,
.backdrop-fade-leave-active {
  transition: opacity 0.3s ease;
}

.backdrop-fade-enter-from,
.backdrop-fade-leave-to {
  opacity: 0;
}

/* Drawer slide transitions */
.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: transform 0.3s ease;
}

.drawer-slide-enter-from,
.drawer-slide-leave-to {
  transform: translateX(100%);
}
</style>
