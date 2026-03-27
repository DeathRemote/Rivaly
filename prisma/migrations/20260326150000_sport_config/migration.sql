-- CreateTable
CREATE TABLE "SportConfig" (
    "sport" "Sport" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SportConfig_pkey" PRIMARY KEY ("sport")
);
