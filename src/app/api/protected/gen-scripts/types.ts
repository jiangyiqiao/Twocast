import { PodcastInputType } from "@/lib/podcast/types";

export type GenScriptsParams = {
    type: PodcastInputType
    text?: string
    file?: File
}