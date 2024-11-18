<script lang="ts" setup>
import AuditStatus from "@/components/warnings/AuditStatus.vue";
import WalletConnect from "@/components/popups/WalletConnect.vue";

const securityLink = "https://github.com/allinbits/security/";
</script>

<template>
  <header>
    <nav class="flex flex-row justify-between md:items-center py-4 w-full select-none relative">
      <div class="flex flex-col md:flex-row justify-start gap-x-8 md:items-center select-none relative">
        <router-link to="/" class="text-500 font-termina py-4">{{ $t("homepage.title") }}</router-link>
      </div>
      <div class="flex flex-row items-center justify-center gap-8">
        <a :href="securityLink" target="_blank" class="hover:text-grey-100 duration-200">{{
          $t("homepage.security")
          }}</a>
        <WalletConnect class="hidden md:block" />
      </div>
    </nav>
    <AuditStatus :link="securityLink" />
  </header>
</template>
