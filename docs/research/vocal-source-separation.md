# Open-source singing-vocal separation

Research date: 2026-11-01

## Recommendation

For *Japanese Denim*, first A/B the existing `htdemucs_6s` vocal against **Kimberley Jensen's MelBand-RoFormer** checkpoint. It is the cleanest legally documented high-quality candidate found: the model card declares MIT, it is directly usable through `audio-separator` or MSST, and MSST reports 10.98 dB vocal SDR on its MVSep Multisong evaluation versus 8.78 dB for its fine-tuned HTDemucs model. Those numbers are comparable within that table, but they are maintainer-reported rather than an independent benchmark. [checkpoint/model card](https://huggingface.co/KimberleyJSN/melbandroformer) · [MSST comparison](https://github.com/ZFTurbo/Music-Source-Separation-Training/blob/main/docs/pretrained_models.md) · [MelBand-RoFormer paper](https://arxiv.org/abs/2310.01809)

Run a second, fast control with **MDX23C vocals** (10.17 dB in the same MSST table), or `UVR-MDX-NET-Voc_FT.onnx` if Apple/CPU turnaround is the priority. MDX ONNX models can use CoreML on Apple Silicon through `audio-separator`; this makes them practical for repeated listening tests even if the RoFormer wins on quality. [MSST MDX23C checkpoint](https://github.com/ZFTurbo/Music-Source-Separation-Training/blob/main/docs/pretrained_models.md) · [UVR](https://github.com/Anjok07/ultimatevocalremovergui) · [audio-separator](https://github.com/nomadkaraoke/python-audio-separator)

For an ensemble experiment, use `audio-separator`'s **`vocal_balanced`** preset (BS-RoFormer Resurrection + MelBand Big Beta 6X, `avg_fft`) only as a local research candidate. It is explicitly community-curated, and the individual weight licenses/lineage are not documented as clearly as the MIT Kimberley model. Do not redistribute those checkpoints until each model's terms are verified. Also compare the ensemble by listening and downstream F0 continuity; do not assume averaging improves breaths, consonants, or quiet tails. [preset definition](https://github.com/nomadkaraoke/python-audio-separator/blob/main/audio_separator/ensemble_presets.json)

The proposed experiment is therefore:

1. existing `htdemucs_6s` vocal;
2. Kimberley MelBand-RoFormer vocal;
3. MDX23C vocal (plus `UVR-MDX-NET-Voc_FT` if a fast ONNX control is useful);
4. community `vocal_balanced` ensemble, kept local and clearly labeled.

Score the outputs for this product, not only SDR: instrument leakage, artificial harmonic tones that confuse pYIN/RMVPE, preservation of breathy onsets and consonants, continuity of sustained fades, and F0 agreement at the known difficult runs. No reviewed source publishes a standardized breath/consonant-preservation metric, so those claims require a level-matched listening/F0 test on *Japanese Denim*.

## Candidate comparison

| Candidate | Evidence and expected behavior | Pretrained vocals | Runtime / integration | License and status | Verdict |
|---|---|---|---|---|---|
| **MelBand-RoFormer** | Overlapping mel-spaced bands and time/frequency attention. The paper reports better vocal, drum, and “other” separation than BS-RoFormer on MUSDB18HQ. MSST's same-dataset table ranks the Kimberley checkpoint at 10.98 dB vocal SDR. Spectral-mask models can still create musical-noise or attenuate weak consonants; the papers do not quantify those perceptual failures. | Yes: Kimberley model; many additional community fine-tunes. | PyTorch; MPS/CPU via `audio-separator`; native fp16 and compilation are supported for verified models. Slower than MDX, particularly with high overlap. CLI and Python APIs. | `audio-separator` and MSST code are MIT. Kimberley model card says MIT. Many other community checkpoints have unclear terms. Both runners are actively maintained. | **Best single-model A/B.** |
| **BS-RoFormer** | Band-split spectrogram Transformer. The paper's smaller model reaches 9.80 dB average four-stem SDR on MUSDB18HQ without extra data; the full system won SDX23 after training on 500 extra songs. MSST lists a community vocal checkpoint at 10.87 dB on its MVSep evaluation. | Yes, largely community-trained vocal and instrumental weights. | PyTorch through MSST or `audio-separator`; MPS/CPU available, but CPU is a slow fallback. | Implementations/runners are MIT; the original paper did not provide the currently popular community checkpoints. Audit each weight separately. | Excellent, especially in an ensemble; weight provenance is the main caveat. |
| **MDX-Net / MDX23C / UVR MDX** | Frequency-domain TFC-TDF family. MSST reports MDX23C vocals at 10.17 dB on the same evaluation where its HTDemucs is 8.78. UVR provides vocal-specialist ONNX models such as `UVR-MDX-NET-Voc_FT`; names describe intended use but are not controlled perceptual benchmarks. | Yes: MDX23C and several UVR vocal/lead-vocal models. | ONNX models are fast and can use CoreML on Apple Silicon in `audio-separator`; CPU is practical. MDX23C is PyTorch. CLI/Python integration is straightforward. | UVR code is MIT and asks third-party users to credit UVR for its models. Original KUIELab MDX research code is old, GPU/training-oriented, and not the convenient inference path. Third-party model licenses still vary. UVR and the aggregators remain maintained. | **Best fast control;** possibly the best iteration-speed/quality trade-off. |
| **SCNet** | Sparse subband compression. The paper reports 9.0 dB average SDR on MUSDB18-HQ without extra data and CPU inference at 48% of HTDemucs time. It is a general four-stem model, not a vocal-specialist checkpoint. | Official MUSDB and SCNet-large checkpoints. | Official PyTorch inference CLI; CPU-friendly relative to HTDemucs, with no documented CoreML path. | Official code MIT; official research repository and checkpoints. Repository is much narrower than MSST/audio-separator. | Strong efficient research baseline, but lower priority than vocal-specialist RoFormer/MDX. |
| **BandIt** | Band-split Transformer family. Official benchmarks list the Vocals V7 model at 25.7M parameters and 0.6 CPU batches/s for 6-second chunks, versus 1.1 for Hybrid Demucs and 20.77 for Open-Unmix in that setup. Its main research focus is cinematic dialogue/music/effects, though a MUSDB vocal model exists. | Official Vocals V7 and MUSDB-related checkpoints/configs. | PyTorch package/research CLI. The official table makes CPU less attractive than HTDemucs despite fewer parameters. | Official code Apache-2.0. Checkpoint terms should still be inspected. | Relevant architecture, but not the first experiment for this workload. |
| **Open-Unmix** | Established magnitude-mask baseline. Lightweight and inspectable, but older than the recent RoFormer/SCNet generation and not designed around vocal-only fidelity. | Official `umxhq`/`umxl` four-stem models. | Very practical PyTorch/CPU baseline; simple Python API and CLI. | Official code MIT; repository documents a 2024 PyTorch 2 update. | Useful sanity baseline, unlikely to beat Demucs/RoFormer. |
| **Spleeter** | Older TensorFlow U-Net separator. Fast and offers a direct two-stem vocal/accompaniment model, but its speed—not current vocal fidelity—is the main advantage. | Official 2-, 4-, and 5-stem pretrained models. | Python/CLI, TensorFlow; official README reports very high GPU throughput. Adds a second framework and is less attractive on the current stack. | Official code MIT. Mature project; not the center of current separator research. | Baseline only. |

## Official research code versus model ecosystems

- **Official research:** the BS-RoFormer, MelBand-RoFormer, SCNet, BandIt, Open-Unmix, Spleeter, and original MDX repositories/papers establish the architectures and published experiments. The popular ready-to-run RoFormer vocal checkpoints generally did **not** come from the paper authors.
- **Training/inference framework:** [MSST](https://github.com/ZFTurbo/Music-Source-Separation-Training) implements many architectures, publishes checkpoints and a common validation table, and supplies training, inference, Python-package, CLI, and ensemble workflows. Its code is MIT; linked weights may come from other authors.
- **Inference aggregator:** [audio-separator](https://github.com/nomadkaraoke/python-audio-separator) is an MIT CLI/Python wrapper around UVR, MDX, Demucs, and RoFormer formats. It auto-downloads checksummed models and supports MPS, CoreML/ONNX, CUDA, and CPU. Its curated ensemble presets are community guidance, not peer-reviewed results.
- **UVR ecosystem:** [Ultimate Vocal Remover](https://github.com/Anjok07/ultimatevocalremovergui) is the maintained GUI/model distribution ecosystem. It credits ZFTurbo for MDX23C and KUIELab for original MDX-Net, provides Apple Silicon support, and states that the GUI code is MIT. “Available in UVR” does not by itself prove that every third-party weight has the same license.

## Apple Silicon and repository fit

`audio-separator` is the most convenient experimental bridge because the same CLI can run MDX ONNX through CoreML and RoFormer through MPS, while also exposing a Python API and ensembles. However, its current dependency requirements should be installed in a **separate virtual environment** rather than merged blindly into this repository's existing audio environment. The runner's README documents platform-specific PyTorch constraints and graceful CPU fallback; keeping it isolated avoids destabilizing Demucs, torch, and torchaudio.

MSST is better if this becomes a training/fine-tuning project. Its example training settings target a 48 GB NVIDIA A6000, while ordinary inference is supported through its package and CLI. For the immediate Mac-based A/B, `audio-separator` is the lower-friction choice.

Store checkpoints and all separated audio under the ignored `workspace/` tree. Publish only derived pitch/loudness metadata. Before any model is packaged or redistributed, record its exact source URL, hash, named author, and model-specific license; the runner's MIT license is not a blanket license for downloaded weights.

## Evaluation protocol for *Japanese Denim*

1. Decode one lossless source WAV and give every model that identical input. Export lossless vocal WAVs; avoid MP3 between separation and pitch extraction.
2. Loudness-match stems for listening without normalizing away quiet tails. Keep an unnormalized copy for envelope analysis.
3. Review the first verse, the 1:06–1:10 passage, the run near 2:30, sustained fades, breathy entries, fricatives, and sections with backing vocals.
4. For each stem, run the same pYIN and RMVPE settings. Compare voiced coverage, octave disagreements, pitch discontinuities, and false voiced frames during instrumental gaps.
5. Blind-listen to short, time-aligned clips for leakage, watery/phase artifacts, consonant loss, breath preservation, and note-tail truncation.
6. Prefer the stem that produces the most trustworthy teaching contour, even if another sounds slightly cleaner in isolation. A small amount of broadband accompaniment may be less harmful than a synthetic tonal artifact that creates a false F0.
7. Only after evaluating individual stems, test the ensemble. Compare `avg_fft`, `min_fft`, and `max_fft` cautiously: “clean” operations can remove quiet vocal detail, while “full” operations can restore both breaths and accompaniment leakage.

## Primary sources

- [BS-RoFormer paper](https://arxiv.org/abs/2309.02612)
- [MelBand-RoFormer paper](https://arxiv.org/abs/2310.01809)
- [SCNet paper](https://arxiv.org/abs/2401.13276) and [official code](https://github.com/starrytong/SCNet)
- [BandIt official code and complexity table](https://github.com/kwatcharasupat/bandit)
- [original KUIELab MDX-Net](https://github.com/kuielab/mdx-net)
- [Ultimate Vocal Remover](https://github.com/Anjok07/ultimatevocalremovergui)
- [MSST framework and pretrained-model table](https://github.com/ZFTurbo/Music-Source-Separation-Training)
- [audio-separator runner and ensemble definitions](https://github.com/nomadkaraoke/python-audio-separator)
- [Open-Unmix official PyTorch repository](https://github.com/sigsep/open-unmix-pytorch)
- [Spleeter official repository](https://github.com/deezer/spleeter)
